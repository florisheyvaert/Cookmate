using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cookmate.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class PromotionDisplayFieldsPerWeek : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Promotions_StoreCode_Sku",
                table: "Promotions");

            migrationBuilder.AddColumn<string>(
                name: "BrandOrSubtitle",
                table: "Promotions",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CanonicalUrl",
                table: "Promotions",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ImageUrl",
                table: "Promotions",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Name",
                table: "Promotions",
                type: "character varying(300)",
                maxLength: 300,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PackSize",
                table: "Promotions",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Promotions_StoreCode_Sku_ValidFrom",
                table: "Promotions",
                columns: new[] { "StoreCode", "Sku", "ValidFrom" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Promotions_StoreCode_ValidFrom",
                table: "Promotions",
                columns: new[] { "StoreCode", "ValidFrom" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Promotions_StoreCode_Sku_ValidFrom",
                table: "Promotions");

            migrationBuilder.DropIndex(
                name: "IX_Promotions_StoreCode_ValidFrom",
                table: "Promotions");

            migrationBuilder.DropColumn(
                name: "BrandOrSubtitle",
                table: "Promotions");

            migrationBuilder.DropColumn(
                name: "CanonicalUrl",
                table: "Promotions");

            migrationBuilder.DropColumn(
                name: "ImageUrl",
                table: "Promotions");

            migrationBuilder.DropColumn(
                name: "Name",
                table: "Promotions");

            migrationBuilder.DropColumn(
                name: "PackSize",
                table: "Promotions");

            migrationBuilder.CreateIndex(
                name: "IX_Promotions_StoreCode_Sku",
                table: "Promotions",
                columns: new[] { "StoreCode", "Sku" },
                unique: true);
        }
    }
}
