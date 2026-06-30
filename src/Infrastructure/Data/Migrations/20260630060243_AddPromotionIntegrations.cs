using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Cookmate.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPromotionIntegrations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Generalise the meal-harvest history into a shared integration-run history,
            // preserving existing rows (they become Kind = 0 / Recipes).
            migrationBuilder.RenameTable(
                name: "SuggestionHarvestRuns",
                newName: "IntegrationRuns");

            migrationBuilder.Sql(
                @"ALTER TABLE ""IntegrationRuns"" RENAME CONSTRAINT ""PK_SuggestionHarvestRuns"" TO ""PK_IntegrationRuns"";");

            migrationBuilder.RenameIndex(
                name: "IX_SuggestionHarvestRuns_SourceId",
                newName: "IX_IntegrationRuns_SourceId",
                table: "IntegrationRuns");

            migrationBuilder.DropIndex(
                name: "IX_SuggestionHarvestRuns_StartedAt",
                table: "IntegrationRuns");

            migrationBuilder.AddColumn<int>(
                name: "Kind",
                table: "IntegrationRuns",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_IntegrationRuns_Kind_StartedAt",
                table: "IntegrationRuns",
                columns: new[] { "Kind", "StartedAt" });

            migrationBuilder.CreateTable(
                name: "PromotionRefreshSchedules",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    DayOfWeek = table.Column<int>(type: "integer", nullable: false),
                    TimeOfDay = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PromotionRefreshSchedules", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "StorePromotionSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    StoreCode = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    LastRunAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LastRunStatus = table.Column<int>(type: "integer", nullable: true),
                    LastRunCount = table.Column<int>(type: "integer", nullable: true),
                    Created = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StorePromotionSettings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StorePromotionSettings_StoreCode",
                table: "StorePromotionSettings",
                column: "StoreCode",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PromotionRefreshSchedules");

            migrationBuilder.DropTable(
                name: "StorePromotionSettings");

            migrationBuilder.DropIndex(
                name: "IX_IntegrationRuns_Kind_StartedAt",
                table: "IntegrationRuns");

            migrationBuilder.DropColumn(
                name: "Kind",
                table: "IntegrationRuns");

            migrationBuilder.Sql(
                @"ALTER TABLE ""IntegrationRuns"" RENAME CONSTRAINT ""PK_IntegrationRuns"" TO ""PK_SuggestionHarvestRuns"";");

            migrationBuilder.RenameIndex(
                name: "IX_IntegrationRuns_SourceId",
                newName: "IX_SuggestionHarvestRuns_SourceId",
                table: "IntegrationRuns");

            migrationBuilder.RenameTable(
                name: "IntegrationRuns",
                newName: "SuggestionHarvestRuns");

            migrationBuilder.CreateIndex(
                name: "IX_SuggestionHarvestRuns_StartedAt",
                table: "SuggestionHarvestRuns",
                column: "StartedAt");
        }
    }
}
