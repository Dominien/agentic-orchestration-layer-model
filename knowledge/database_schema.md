# Database Schema

The database consists of 3 main tables in Supabase (PostgreSQL).

## Tables

### 1. `clients`
Represents the companies we invoice.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key. |
| `name` | `text` | Name of the client company (e.g., "Stark Industries"). |
| `industry` | `text` | The industry the client belongs to (e.g., "Technology", "Defense"). |
| `tax_region` | `text` | Tax jurisdiction code: "EU_DE", "US", "UK". |

### 2. `projects`
Represents specific engagements with a client.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key. |
| `client_id` | `uuid` | Foreign Key referencing `clients.id`. |
| `name` | `text` | Project name (e.g., "Arc Reactor Maintenance"). |
| `industry` | `text` | The specific industry sector for this project (optional, defaults to client industry). |
| `hourly_rate` | `numeric` | The hourly billing rate for this project (e.g., 250.00). |

### 3. `work_logs`
Represents hours worked on a project.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key. |
| `project_id` | `uuid` | Foreign Key referencing `projects.id`. |
| `hours` | `numeric` | Number of hours worked (e.g., 4.5). |
| `date` | `date` | The date the work was performed (YYYY-MM-DD). |
