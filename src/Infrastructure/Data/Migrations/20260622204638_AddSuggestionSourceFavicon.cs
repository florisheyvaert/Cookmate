using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cookmate.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSuggestionSourceFavicon : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FaviconStorageKey",
                table: "SuggestionSources",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FaviconStorageKey",
                table: "SuggestionSources");
        }
    }
}
