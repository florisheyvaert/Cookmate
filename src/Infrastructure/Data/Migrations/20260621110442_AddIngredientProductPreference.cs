using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Cookmate.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddIngredientProductPreference : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "IngredientProductPreferences",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    NormalizedName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    StoreCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    GroceryProductId = table.Column<int>(type: "integer", nullable: false),
                    DefaultPackQuantity = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IngredientProductPreferences", x => x.Id);
                    table.ForeignKey(
                        name: "FK_IngredientProductPreferences_GroceryProducts_GroceryProduct~",
                        column: x => x.GroceryProductId,
                        principalTable: "GroceryProducts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_IngredientProductPreferences_GroceryProductId",
                table: "IngredientProductPreferences",
                column: "GroceryProductId");

            migrationBuilder.CreateIndex(
                name: "IX_IngredientProductPreferences_NormalizedName_StoreCode",
                table: "IngredientProductPreferences",
                columns: new[] { "NormalizedName", "StoreCode" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "IngredientProductPreferences");
        }
    }
}
