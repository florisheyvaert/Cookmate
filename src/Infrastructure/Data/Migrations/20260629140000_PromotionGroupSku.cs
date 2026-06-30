using Cookmate.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cookmate.Infrastructure.Data.Migrations
{
    // Hand-authored (the app was holding a build lock when this was added). Equivalent to
    // `dotnet ef migrations add PromotionGroupSku`; regenerate cleanly if the Designer is needed.
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260629140000_PromotionGroupSku")]
    public partial class PromotionGroupSku : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "GroupSku",
                table: "Promotions",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Promotions_StoreCode_GroupSku",
                table: "Promotions",
                columns: new[] { "StoreCode", "GroupSku" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Promotions_StoreCode_GroupSku",
                table: "Promotions");

            migrationBuilder.DropColumn(
                name: "GroupSku",
                table: "Promotions");
        }
    }
}
