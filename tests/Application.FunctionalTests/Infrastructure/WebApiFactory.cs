using Cookmate.Application.Common.Interfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Cookmate.Application.FunctionalTests.Infrastructure;

public class WebApiFactory(string connectionString) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder
            .UseSetting("ConnectionStrings:CookmateDb", connectionString);

        builder.ConfigureTestServices(services =>
        {
            services
                .RemoveAll<IUser>()
                .AddTransient(provider =>
                {
                    var mock = new Mock<IUser>();
                    mock.SetupGet(x => x.Roles).Returns(TestApp.GetRoles());
                    mock.SetupGet(x => x.Id).Returns(TestApp.GetUserId());
                    return mock.Object;
                });

            // Don't reach the network when creating/editing a source in tests.
            services
                .RemoveAll<IFaviconFetcher>()
                .AddTransient(_ =>
                {
                    var mock = new Mock<IFaviconFetcher>();
                    mock.Setup(x => x.FetchAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                        .ReturnsAsync((string?)null);
                    return mock.Object;
                });
        });
    }
}
