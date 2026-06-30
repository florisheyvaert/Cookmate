using Cookmate.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cookmate.Infrastructure.Data.Migrations
{
    // Hand-authored (the app was holding a build lock when this was added). Equivalent to
    // `dotnet ef migrations add PromotionCategoryOrder`; regenerate cleanly if the Designer
    // model is ever needed.
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260629120000_PromotionCategoryOrder")]
    public partial class PromotionCategoryOrder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "Promotions",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DisplayOrder",
                table: "Promotions",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "Category", table: "Promotions");
            migrationBuilder.DropColumn(name: "DisplayOrder", table: "Promotions");
        }
    }
}
