using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Cookmate.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMealSuggestions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SuggestionHarvestRuns",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SourceId = table.Column<int>(type: "integer", nullable: true),
                    Trigger = table.Column<int>(type: "integer", nullable: false),
                    StartedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    FinishedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Discovered = table.Column<int>(type: "integer", nullable: false),
                    Inserted = table.Column<int>(type: "integer", nullable: false),
                    SkippedDuplicate = table.Column<int>(type: "integer", nullable: false),
                    Failed = table.Column<int>(type: "integer", nullable: false),
                    Sources = table.Column<string>(type: "jsonb", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SuggestionHarvestRuns", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SuggestionSources",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Host = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    ListingUrls = table.Column<string[]>(type: "text[]", nullable: false, defaultValueSql: "ARRAY[]::text[]"),
                    MaxPerRun = table.Column<int>(type: "integer", nullable: true),
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
                    table.PrimaryKey("PK_SuggestionSources", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MealSuggestions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SourceId = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Summary = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    SourceUrl = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: false),
                    BaseServings = table.Column<int>(type: "integer", nullable: false),
                    TotalTimeMinutes = table.Column<int>(type: "integer", nullable: true),
                    ImageStorageKey = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    HarvestedOn = table.Column<DateOnly>(type: "date", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: false, defaultValueSql: "ARRAY[]::text[]"),
                    Ingredients = table.Column<string>(type: "jsonb", nullable: false),
                    Steps = table.Column<string>(type: "jsonb", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MealSuggestions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MealSuggestions_SuggestionSources_SourceId",
                        column: x => x.SourceId,
                        principalTable: "SuggestionSources",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MealSuggestions_HarvestedOn",
                table: "MealSuggestions",
                column: "HarvestedOn");

            migrationBuilder.CreateIndex(
                name: "IX_MealSuggestions_SourceId",
                table: "MealSuggestions",
                column: "SourceId");

            migrationBuilder.CreateIndex(
                name: "IX_MealSuggestions_SourceUrl",
                table: "MealSuggestions",
                column: "SourceUrl",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SuggestionHarvestRuns_SourceId",
                table: "SuggestionHarvestRuns",
                column: "SourceId");

            migrationBuilder.CreateIndex(
                name: "IX_SuggestionHarvestRuns_StartedAt",
                table: "SuggestionHarvestRuns",
                column: "StartedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MealSuggestions");

            migrationBuilder.DropTable(
                name: "SuggestionHarvestRuns");

            migrationBuilder.DropTable(
                name: "SuggestionSources");
        }
    }
}
