using Cookmate.Domain.Constants;
using Cookmate.Infrastructure.Identity;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Web.Endpoints;

/// <summary>
/// First-run bootstrap. While the database holds zero users, the front-end
/// renders an onboarding flow that calls <c>POST /api/Setup</c> to create the
/// administrator account. After that, the endpoint locks itself out (409).
/// </summary>
public class Setup : IEndpointGroup
{
    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.MapGet(GetStatus, "status");
        groupBuilder.MapPost(CompleteSetup);
    }

    [EndpointSummary("Setup status")]
    [EndpointDescription("Returns whether the application still needs to be bootstrapped (no users exist).")]
    public static async Task<Ok<SetupStatusDto>> GetStatus(
        UserManager<ApplicationUser> userManager,
        CancellationToken cancellationToken)
    {
        var hasAny = await userManager.Users.AnyAsync(cancellationToken);
        return TypedResults.Ok(new SetupStatusDto { NeedsSetup = !hasAny });
    }

    [EndpointSummary("Complete first-run setup")]
    [EndpointDescription("Creates the first administrator account and signs them in via cookies. Returns 409 once an account already exists.")]
    public static async Task<Results<NoContent, Conflict<ProblemDetails>, ValidationProblem>> CompleteSetup(
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole> roleManager,
        SignInManager<ApplicationUser> signInManager,
        [FromBody] CompleteSetupDto body,
        CancellationToken cancellationToken)
    {
        if (await userManager.Users.AnyAsync(cancellationToken))
        {
            return TypedResults.Conflict(new ProblemDetails
            {
                Title = "Setup already completed.",
                Detail = "An administrator account already exists. Sign in instead.",
            });
        }

        var quickErrors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(body.Email))
            quickErrors["email"] = new[] { "Email is required." };
        if (string.IsNullOrWhiteSpace(body.Password))
            quickErrors["password"] = new[] { "Password is required." };
        if (quickErrors.Count > 0)
            return TypedResults.ValidationProblem(quickErrors);

        var user = new ApplicationUser
        {
            UserName = body.Email.Trim(),
            Email = body.Email.Trim(),
            // Local single-tenant app — no email confirmation flow.
            EmailConfirmed = true,
        };

        var createResult = await userManager.CreateAsync(user, body.Password);
        if (!createResult.Succeeded)
        {
            var errors = createResult.Errors
                .GroupBy(e => MapErrorToField(e.Code))
                .ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray());
            return TypedResults.ValidationProblem(errors);
        }

        if (!await roleManager.RoleExistsAsync(Roles.Administrator))
        {
            await roleManager.CreateAsync(new IdentityRole(Roles.Administrator));
        }
        await userManager.AddToRoleAsync(user, Roles.Administrator);

        // Persistent cookie so the user stays signed in after the redirect.
        await signInManager.SignInAsync(user, isPersistent: true);

        return TypedResults.NoContent();
    }

    private static string MapErrorToField(string code) =>
        code.Contains("Password", StringComparison.OrdinalIgnoreCase) ? "password" :
        code.Contains("Email", StringComparison.OrdinalIgnoreCase) ? "email" :
        code.Contains("UserName", StringComparison.OrdinalIgnoreCase) ? "email" :
        "general";
}

public record SetupStatusDto
{
    public bool NeedsSetup { get; init; }
}

public record CompleteSetupDto
{
    public string Email { get; init; } = string.Empty;
    public string Password { get; init; } = string.Empty;
}
