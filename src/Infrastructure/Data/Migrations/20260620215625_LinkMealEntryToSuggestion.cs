using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cookmate.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class LinkMealEntryToSuggestion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "MealSuggestionId",
                table: "MealEntries",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_MealEntries_MealSuggestionId",
                table: "MealEntries",
                column: "MealSuggestionId");

            migrationBuilder.AddForeignKey(
                name: "FK_MealEntries_MealSuggestions_MealSuggestionId",
                table: "MealEntries",
                column: "MealSuggestionId",
                principalTable: "MealSuggestions",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MealEntries_MealSuggestions_MealSuggestionId",
                table: "MealEntries");

            migrationBuilder.DropIndex(
                name: "IX_MealEntries_MealSuggestionId",
                table: "MealEntries");

            migrationBuilder.DropColumn(
                name: "MealSuggestionId",
                table: "MealEntries");
        }
    }
}
