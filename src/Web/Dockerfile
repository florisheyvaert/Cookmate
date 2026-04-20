# syntax=docker/dockerfile:1.7

# ---- Build stage ---------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy solution-level files so restore can resolve transitive references.
COPY Directory.Build.props Directory.Packages.props global.json ./

# Copy only the .csproj files first to maximise layer caching for restore.
COPY src/Web/Web.csproj                       src/Web/
COPY src/Application/Application.csproj       src/Application/
COPY src/Infrastructure/Infrastructure.csproj src/Infrastructure/
COPY src/Domain/Domain.csproj                 src/Domain/
COPY src/Shared/Shared.csproj                 src/Shared/
COPY src/ServiceDefaults/ServiceDefaults.csproj src/ServiceDefaults/

RUN dotnet restore src/Web/Web.csproj

# Now copy the actual source.
COPY src/. src/

RUN dotnet publish src/Web/Web.csproj \
    --configuration Release \
    --no-restore \
    --output /app/publish \
    /p:UseAppHost=false

# ---- Runtime stage -------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Non-root user for the app process.
RUN groupadd --system cookmate && useradd --system --gid cookmate cookmate

# Media is written to App_Data/media; matches the FileStorage:RootPath default in appsettings.json.
RUN mkdir -p /app/App_Data/media && chown -R cookmate:cookmate /app/App_Data
USER cookmate

COPY --from=build --chown=cookmate:cookmate /app/publish .

ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_URLS=http://+:8080 \
    DOTNET_RUNNING_IN_CONTAINER=true

EXPOSE 8080

ENTRYPOINT ["dotnet", "Cookmate.Web.dll"]
