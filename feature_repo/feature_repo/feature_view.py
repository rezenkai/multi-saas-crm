from feast import Entity, FeatureView, Field, FileSource, ValueType
from feast.types import Int64, Float32
from datetime import timedelta

# Data source (CSV/Parquet)
customer_stats_source = FileSource(
    path="data/customer_stats.parquet",
    timestamp_field="event_timestamp",
    created_timestamp_column="created",
)


# Entity
customer = Entity(
    name="customer_id",
    join_keys=["customer_id"],
    value_type=ValueType.INT64  # ✅ correct fix
)

# FeatureView
customer_stats_fv = FeatureView(
    name="customer_stats",
    entities=[customer],
    ttl=timedelta(days=1),
    schema=[
        Field(name="transactions", dtype=Int64),
        Field(name="total_spent", dtype=Float32),
    ],
    source=customer_stats_source,
)
