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

# Google Chrome — Playwright drives it (Channel="chrome") to scrape the ah.be bonus
# folder. The site is gated by Akamai bot-management, which 403s Chromium's headless-shell
# build; real Chrome passes. Chrome pulls its own runtime deps via apt.
RUN apt-get update \
 && apt-get install -y --no-install-recommends wget gnupg ca-certificates \
 && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
 && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends google-chrome-stable \
 && rm -rf /var/lib/apt/lists/*

# Non-root user for the app process.
RUN groupadd --system cookmate && useradd --system --gid cookmate cookmate

# Media is written to App_Data/media; matches the FileStorage:RootPath default in appsettings.json.
RUN mkdir -p /app/App_Data/media && chown -R cookmate:cookmate /app/App_Data
USER cookmate

COPY --from=build --chown=cookmate:cookmate /app/publish .

ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_URLS=http://+:8080 \
    DOTNET_RUNNING_IN_CONTAINER=true \
    HOME=/tmp

EXPOSE 8080

ENTRYPOINT ["dotnet", "Cookmate.Web.dll"]
