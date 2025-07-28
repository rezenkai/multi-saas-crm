#!/usr/bin/env python3
"""
Скрипт инициализации Apache Superset для CRM Analytics
Создает пользователей, подключения к базам данных и базовые дашборды
"""

import os
import sys
import json
from superset import app, db
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.connectors.sqla.models import SqlaTable
from flask_appbuilder.security.sqla.models import User, Role
from superset.security import SupersetSecurityManager

def create_admin_user():
    """Создать администратора если его нет"""
    print("🔧 Creating admin user...")
    
    security_manager = app.appbuilder.sm
    admin_role = security_manager.find_role("Admin")
    
    # Проверяем есть ли уже админ
    admin_user = security_manager.find_user("admin")
    if admin_user:
        print("✅ Admin user already exists")
        return admin_user
    
    # Создаем админа
    admin_user = security_manager.add_user(
        username="admin",
        first_name="Admin",
        last_name="CRM",
        email="admin@crm.local",
        role=admin_role,
        password="admin123"
    )
    
    print("✅ Admin user created: admin/admin123")
    return admin_user

def create_database_connections():
    """Создать подключения к базам данных"""
    print("🔧 Creating database connections...")
    
    connections = [
        {
            'database_name': 'CRM ClickHouse',
            'sqlalchemy_uri': 'clickhousedb://analytics:analytics_password@clickhouse-analytics:8123/crm_analytics',
            'extra': json.dumps({
                "metadata_params": {},
                "engine_params": {
                    "connect_args": {
                        "protocol": "http"
                    }
                }
            })
        },
        {
            'database_name': 'CRM PostgreSQL',
            'sqlalchemy_uri': 'postgresql://postgres:password@postgres-analytics-fresh:5432/salesforce_clone',
            'extra': json.dumps({
                "metadata_params": {},
                "engine_params": {}
            })
        }
    ]
    
    created_dbs = []
    
    for conn in connections:
        # Проверяем существует ли уже
        existing_db = db.session.query(Database).filter_by(
            database_name=conn['database_name']
        ).first()
        
        if existing_db:
            print(f"✅ Database connection '{conn['database_name']}' already exists")
            created_dbs.append(existing_db)
            continue
        
        # Создаем новое подключение
        database = Database(
            database_name=conn['database_name'],
            sqlalchemy_uri=conn['sqlalchemy_uri'],
            extra=conn['extra']
        )
        
        db.session.add(database)
        db.session.commit()
        created_dbs.append(database)
        print(f"✅ Created database connection: {conn['database_name']}")
    
    return created_dbs

def create_base_tables():
    """Создать базовые таблицы для дашбордов"""
    print("🔧 Creating base tables...")
    
    # Найдем ClickHouse подключение
    clickhouse_db = db.session.query(Database).filter_by(
        database_name='CRM ClickHouse'
    ).first()
    
    if not clickhouse_db:
        print("❌ ClickHouse connection not found")
        return []
    
    # Определяем таблицы для создания
    tables_to_create = [
        {
            'table_name': 'deals',
            'schema': 'crm_analytics',
            'database_id': clickhouse_db.id
        },
        {
            'table_name': 'leads', 
            'schema': 'crm_analytics',
            'database_id': clickhouse_db.id
        },
        {
            'table_name': 'activities',
            'schema': 'crm_analytics', 
            'database_id': clickhouse_db.id
        }
    ]
    
    created_tables = []
    
    for table_info in tables_to_create:
        # Проверяем существует ли таблица
        existing_table = db.session.query(SqlaTable).filter_by(
            table_name=table_info['table_name'],
            database_id=table_info['database_id']
        ).first()
        
        if existing_table:
            print(f"✅ Table '{table_info['table_name']}' already exists")
            created_tables.append(existing_table)
            continue
        
        # Создаем таблицу
        sqla_table = SqlaTable(
            table_name=table_info['table_name'],
            schema=table_info['schema'],
            database_id=table_info['database_id']
        )
        
        db.session.add(sqla_table)
        db.session.commit()
        created_tables.append(sqla_table)
        print(f"✅ Created table: {table_info['table_name']}")
    
    return created_tables

def create_sample_dashboard():
    """Создать пример дашборда"""
    print("🔧 Creating sample dashboard...")
    
    # Проверяем существует ли дашборд
    existing_dashboard = db.session.query(Dashboard).filter_by(
        dashboard_title='CRM Analytics Overview'
    ).first()
    
    if existing_dashboard:
        print("✅ Sample dashboard already exists")
        return existing_dashboard
    
    # Создаем дашборд
    dashboard = Dashboard(
        dashboard_title='CRM Analytics Overview',
        position_json=json.dumps({
            "DASHBOARD_VERSION_KEY": "v2",
            "ROOT_ID": "GRID_ID",
            "GRID_ID": {
                "type": "GRID",
                "id": "GRID_ID", 
                "children": [],
                "parents": ["ROOT_ID"]
            }
        }),
        json_metadata=json.dumps({
            "refresh_frequency": 300,
            "timed_refresh_immune_slices": [],
            "expanded_slices": {},
            "color_scheme": "supersetColors",
            "label_colors": {},
            "shared_label_colors": {},
            "color_scheme_domain": [],
            "cross_filters_enabled": True
        })
    )
    
    db.session.add(dashboard)
    db.session.commit()
    print("✅ Created sample dashboard: CRM Analytics Overview")
    
    return dashboard

def main():
    """Основная функция инициализации"""
    print("🚀 Initializing Superset for CRM Analytics...")
    
    with app.app_context():
        try:
            # Создаем админа
            admin_user = create_admin_user()
            
            # Создаем подключения к БД
            databases = create_database_connections()
            
            # Создаем таблицы
            tables = create_base_tables()
            
            # Создаем пример дашборда
            dashboard = create_sample_dashboard()
            
            print("\n✅ Superset initialization completed successfully!")
            print("\n📊 Access Information:")
            print("   URL: http://localhost:8006")
            print("   Username: admin")
            print("   Password: admin123")
            print("\n💾 Database Connections:")
            for db_conn in databases:
                print(f"   - {db_conn.database_name}")
            print("\n📈 Available Tables:")
            for table in tables:
                print(f"   - {table.schema}.{table.table_name}")
            
        except Exception as e:
            print(f"❌ Error during initialization: {e}")
            sys.exit(1)

if __name__ == "__main__":
    main()