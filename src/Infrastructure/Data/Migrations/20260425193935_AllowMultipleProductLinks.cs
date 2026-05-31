using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cookmate.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AllowMultipleProductLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_RecipeIngredientProductLinks_IngredientId_StoreCode",
                table: "RecipeIngredientProductLinks");

            migrationBuilder.CreateIndex(
                name: "IX_RecipeIngredientProductLinks_IngredientId_GroceryProductId",
                table: "RecipeIngredientProductLinks",
                columns: new[] { "IngredientId", "GroceryProductId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RecipeIngredientProductLinks_IngredientId_StoreCode",
                table: "RecipeIngredientProductLinks",
                columns: new[] { "IngredientId", "StoreCode" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_RecipeIngredientProductLinks_IngredientId_GroceryProductId",
                table: "RecipeIngredientProductLinks");

            migrationBuilder.DropIndex(
                name: "IX_RecipeIngredientProductLinks_IngredientId_StoreCode",
                table: "RecipeIngredientProductLinks");

            migrationBuilder.CreateIndex(
                name: "IX_RecipeIngredientProductLinks_IngredientId_StoreCode",
                table: "RecipeIngredientProductLinks",
                columns: new[] { "IngredientId", "StoreCode" },
                unique: true);
        }
    }
}
