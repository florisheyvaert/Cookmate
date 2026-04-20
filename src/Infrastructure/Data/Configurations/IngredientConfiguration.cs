using Cookmate.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookmate.Infrastructure.Data.Configurations;

public class IngredientConfiguration : IEntityTypeConfiguration<Ingredient>
{
    public void Configure(EntityTypeBuilder<Ingredient> builder)
    {
        builder.ToTable("Ingredients");

        builder.Property(i => i.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(i => i.Notes)
            .HasMaxLength(500);

        builder.Property(i => i.Order)
            .IsRequired();

        builder.OwnsOne(i => i.Quantity, q =>
        {
            q.Property(p => p.Amount)
                .HasColumnName("QuantityAmount")
                .HasPrecision(12, 4)
                .IsRequired();

            q.Property(p => p.Unit)
                .HasColumnName("QuantityUnit")
                .HasMaxLength(50)
                .IsRequired();
        });

        builder.Navigation(i => i.Quantity).IsRequired();
    }
}
