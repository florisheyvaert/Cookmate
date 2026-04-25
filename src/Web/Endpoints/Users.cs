using System.Security.Claims;
using Cookmate.Domain.Constants;
using Cookmate.Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Web.Endpoints;

public class Users : IEndpointGroup
{
    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.MapIdentityApi<ApplicationUser>();

        groupBuilder.MapPost(Logout, "logout").RequireAuthorization();

        // The current authenticated user's profile, including roles. The
        // built-in /manage/info endpoint doesn't surface roles, so the SPA
        // calls this on boot to know whether to show admin UI.
        groupBuilder.MapGet(GetMe, "me").RequireAuthorization();
        groupBuilder.MapPost(ChangeMyPassword, "me/password").RequireAuthorization();

        // Admin-only directory. Roles attribute is enough — SetDefaultPolicy
        // already requires authentication.
        groupBuilder.MapGet(ListUsers, "directory")
            .RequireAuthorization(Roles.Administrator);
        groupBuilder.MapPost(InviteUser, "directory")
            .RequireAuthorization(Roles.Administrator);
        groupBuilder.MapPost(ResetUserPassword, "directory/{userId}/reset")
            .RequireAuthorization(Roles.Administrator);
        groupBuilder.MapPost(SetUserAdmin, "directory/{userId}/admin")
            .RequireAuthorization(Roles.Administrator);
        groupBuilder.MapDelete(DeleteUser, "directory/{userId}")
            .RequireAuthorization(Roles.Administrator);

        // Public — redemption flow. Used by both invitations (user has no
        // password yet) and admin-triggered resets. Identity's
        // ResetPasswordAsync handles both cases identically.
        groupBuilder.MapPost(Redeem, "redeem").AllowAnonymous();
    }

    [EndpointSummary("Log out")]
    [EndpointDescription("Logs out the current user by clearing the authentication cookie.")]
    public static async Task<Results<Ok, UnauthorizedHttpResult>> Logout(SignInManager<ApplicationUser> signInManager, [FromBody] object empty)
    {
        if (empty != null)
        {
            await signInManager.SignOutAsync();
            return TypedResults.Ok();
        }

        return TypedResults.Unauthorized();
    }

    [EndpointSummary("Current user's profile")]
    public static async Task<Results<Ok<MeDto>, UnauthorizedHttpResult>> GetMe(
        UserManager<ApplicationUser> userManager,
        ClaimsPrincipal principal)
    {
        var user = await userManager.GetUserAsync(principal);
        if (user is null) return TypedResults.Unauthorized();

        var roles = await userManager.GetRolesAsync(user);
        return TypedResults.Ok(new MeDto
        {
            Id = user.Id,
            Email = user.Email ?? string.Empty,
            Roles = roles.ToArray(),
        });
    }

    [EndpointSummary("Change own password")]
    public static async Task<Results<NoContent, ValidationProblem, UnauthorizedHttpResult>> ChangeMyPassword(
        UserManager<ApplicationUser> userManager,
        ClaimsPrincipal principal,
        [FromBody] ChangePasswordDto body)
    {
        var user = await userManager.GetUserAsync(principal);
        if (user is null) return TypedResults.Unauthorized();

        if (string.IsNullOrEmpty(body.NewPassword))
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["newPassword"] = new[] { "New password is required." }
            });

        var hasPassword = await userManager.HasPasswordAsync(user);
        var result = hasPassword
            ? await userManager.ChangePasswordAsync(user, body.CurrentPassword ?? string.Empty, body.NewPassword)
            : await userManager.AddPasswordAsync(user, body.NewPassword);

        return result.Succeeded
            ? TypedResults.NoContent()
            : TypedResults.ValidationProblem(GroupErrors(result.Errors));
    }

    [EndpointSummary("List users (admin)")]
    public static async Task<Ok<IReadOnlyList<UserSummaryDto>>> ListUsers(
        UserManager<ApplicationUser> userManager,
        CancellationToken cancellationToken)
    {
        // Pulling everything is fine for a personal/family-scale app. If this
        // ever grows we can paginate, but adding it now is YAGNI.
        var users = await userManager.Users
            .OrderBy(u => u.Email)
            .ToListAsync(cancellationToken);

        var summaries = new List<UserSummaryDto>(users.Count);
        foreach (var u in users)
        {
            var roles = await userManager.GetRolesAsync(u);
            summaries.Add(new UserSummaryDto
            {
                Id = u.Id,
                Email = u.Email ?? string.Empty,
                Roles = roles.ToArray(),
                IsAdmin = roles.Contains(Roles.Administrator),
                HasPassword = await userManager.HasPasswordAsync(u),
            });
        }

        return TypedResults.Ok<IReadOnlyList<UserSummaryDto>>(summaries);
    }

    [EndpointSummary("Invite a new user (admin)")]
    [EndpointDescription("Creates a user without a password and returns a redemption token the admin shares manually. The recipient sets their password on first visit.")]
    public static async Task<Results<Ok<RedemptionLinkDto>, ValidationProblem, Conflict<ProblemDetails>>> InviteUser(
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole> roleManager,
        [FromBody] InviteUserDto body)
    {
        var email = body.Email?.Trim();
        if (string.IsNullOrEmpty(email))
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["email"] = new[] { "Email is required." }
            });

        if (await userManager.FindByEmailAsync(email) is not null)
            return TypedResults.Conflict(new ProblemDetails
            {
                Title = "Already invited",
                Detail = "A user with that email already exists.",
            });

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true,
        };

        var createResult = await userManager.CreateAsync(user);
        if (!createResult.Succeeded)
            return TypedResults.ValidationProblem(GroupErrors(createResult.Errors));

        if (body.IsAdmin)
        {
            await EnsureRoleExists(roleManager, Roles.Administrator);
            await userManager.AddToRoleAsync(user, Roles.Administrator);
        }

        var token = await userManager.GeneratePasswordResetTokenAsync(user);
        return TypedResults.Ok(BuildRedemptionLink(user, token));
    }

    [EndpointSummary("Generate a password-reset token (admin)")]
    public static async Task<Results<Ok<RedemptionLinkDto>, NotFound, ProblemHttpResult>> ResetUserPassword(
        UserManager<ApplicationUser> userManager,
        ClaimsPrincipal principal,
        string userId)
    {
        var user = await userManager.FindByIdAsync(userId);
        if (user is null) return TypedResults.NotFound();

        // Admins can only reset their own password or that of non-admin
        // members. Once another admin has set up their account, only they
        // can change their password — anyone else has to demote them first.
        var caller = await userManager.GetUserAsync(principal);
        if (caller is not null && caller.Id != user.Id
            && await userManager.IsInRoleAsync(user, Roles.Administrator)
            && await userManager.HasPasswordAsync(user))
        {
            return TypedResults.Problem(
                statusCode: StatusCodes.Status403Forbidden,
                title: "Cannot change another admin's password",
                detail: "Demote them to a member first, or ask them to reset their own password.");
        }

        var token = await userManager.GeneratePasswordResetTokenAsync(user);
        return TypedResults.Ok(BuildRedemptionLink(user, token));
    }

    [EndpointSummary("Promote or demote an admin (admin)")]
    public static async Task<Results<NoContent, NotFound, BadRequest<ProblemDetails>>> SetUserAdmin(
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole> roleManager,
        ClaimsPrincipal principal,
        string userId,
        [FromBody] SetAdminDto body)
    {
        var user = await userManager.FindByIdAsync(userId);
        if (user is null) return TypedResults.NotFound();

        var isAdmin = await userManager.IsInRoleAsync(user, Roles.Administrator);
        if (isAdmin == body.IsAdmin) return TypedResults.NoContent();

        if (body.IsAdmin)
        {
            await EnsureRoleExists(roleManager, Roles.Administrator);
            await userManager.AddToRoleAsync(user, Roles.Administrator);
            return TypedResults.NoContent();
        }

        // Demoting — refuse if this is the last admin or the caller themselves.
        var caller = await userManager.GetUserAsync(principal);
        if (caller is not null && caller.Id == user.Id)
            return TypedResults.BadRequest(new ProblemDetails
            {
                Title = "Cannot demote yourself",
                Detail = "Ask another admin to demote your account.",
            });

        var admins = await userManager.GetUsersInRoleAsync(Roles.Administrator);
        if (admins.Count <= 1)
            return TypedResults.BadRequest(new ProblemDetails
            {
                Title = "Last administrator",
                Detail = "Promote another user to admin before demoting this one.",
            });

        await userManager.RemoveFromRoleAsync(user, Roles.Administrator);
        return TypedResults.NoContent();
    }

    [EndpointSummary("Delete a user (admin)")]
    public static async Task<Results<NoContent, NotFound, BadRequest<ProblemDetails>>> DeleteUser(
        UserManager<ApplicationUser> userManager,
        ClaimsPrincipal principal,
        string userId)
    {
        var user = await userManager.FindByIdAsync(userId);
        if (user is null) return TypedResults.NotFound();

        var caller = await userManager.GetUserAsync(principal);
        if (caller is not null && caller.Id == user.Id)
            return TypedResults.BadRequest(new ProblemDetails
            {
                Title = "Cannot delete yourself",
                Detail = "Sign out and ask another admin to remove your account.",
            });

        if (await userManager.IsInRoleAsync(user, Roles.Administrator))
        {
            var admins = await userManager.GetUsersInRoleAsync(Roles.Administrator);
            if (admins.Count <= 1)
                return TypedResults.BadRequest(new ProblemDetails
                {
                    Title = "Last administrator",
                    Detail = "Promote another user to admin before deleting this one.",
                });
        }

        var result = await userManager.DeleteAsync(user);
        if (!result.Succeeded)
            return TypedResults.BadRequest(new ProblemDetails
            {
                Title = "Delete failed",
                Detail = string.Join(" ", result.Errors.Select(e => e.Description)),
            });

        return TypedResults.NoContent();
    }

    [EndpointSummary("Redeem an invitation or password reset")]
    [EndpointDescription("Sets the user's password using the token from the redemption link, then signs them in via cookies.")]
    public static async Task<Results<NoContent, ValidationProblem, NotFound>> Redeem(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        [FromBody] RedeemDto body)
    {
        if (string.IsNullOrEmpty(body.UserId) || string.IsNullOrEmpty(body.Token) || string.IsNullOrEmpty(body.Password))
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["password"] = new[] { "Password is required." }
            });

        var user = await userManager.FindByIdAsync(body.UserId);
        if (user is null) return TypedResults.NotFound();

        // ResetPasswordAsync handles both "user has no password yet" (invite)
        // and "user is overwriting an existing password" (admin reset). It
        // also rotates the security stamp, invalidating the token afterwards.
        var result = await userManager.ResetPasswordAsync(user, body.Token, body.Password);
        if (!result.Succeeded)
            return TypedResults.ValidationProblem(GroupErrors(result.Errors));

        await signInManager.SignInAsync(user, isPersistent: true);
        return TypedResults.NoContent();
    }

    // ───────────────────────────────────────────────────────────────────────────

    private static RedemptionLinkDto BuildRedemptionLink(ApplicationUser user, string token)
    {
        // The frontend composes the URL using window.location.origin so the
        // host matches the page the admin is on (Vite dev port, prod domain,
        // reverse proxy — all just work).
        return new RedemptionLinkDto
        {
            UserId = user.Id,
            Email = user.Email ?? string.Empty,
            Token = token,
        };
    }

    private static async Task EnsureRoleExists(RoleManager<IdentityRole> roleManager, string role)
    {
        if (!await roleManager.RoleExistsAsync(role))
            await roleManager.CreateAsync(new IdentityRole(role));
    }

    private static Dictionary<string, string[]> GroupErrors(IEnumerable<IdentityError> errors)
    {
        return errors
            .GroupBy(e => MapErrorToField(e.Code))
            .ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray());
    }

    private static string MapErrorToField(string code) =>
        code.Contains("Password", StringComparison.OrdinalIgnoreCase) ? "password" :
        code.Contains("Email", StringComparison.OrdinalIgnoreCase) ? "email" :
        code.Contains("UserName", StringComparison.OrdinalIgnoreCase) ? "email" :
        "general";
}

public record MeDto
{
    public string Id { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string[] Roles { get; init; } = Array.Empty<string>();
}

public record UserSummaryDto
{
    public string Id { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string[] Roles { get; init; } = Array.Empty<string>();
    public bool IsAdmin { get; init; }
    public bool HasPassword { get; init; }
}

public record InviteUserDto
{
    public string Email { get; init; } = string.Empty;
    public bool IsAdmin { get; init; }
}

public record SetAdminDto
{
    public bool IsAdmin { get; init; }
}

public record RedemptionLinkDto
{
    public string UserId { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string Token { get; init; } = string.Empty;
}

public record RedeemDto
{
    public string UserId { get; init; } = string.Empty;
    public string Token { get; init; } = string.Empty;
    public string Password { get; init; } = string.Empty;
}

public record ChangePasswordDto
{
    public string? CurrentPassword { get; init; }
    public string NewPassword { get; init; } = string.Empty;
}
