use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::DbError;
use crate::GraphStore;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShareHistoryEntry {
    pub id: String,
    pub workspace_id: String,
    pub workspace_name: String,
    pub token: String,
    pub url: String,
    pub password: Option<String>,
    pub password_set: bool,
    pub receipt_markdown: String,
    pub published_at: String,
    pub expires_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone)]
pub struct RecordShareHistoryInput {
    pub workspace_id: String,
    pub workspace_name: String,
    pub token: String,
    pub url: String,
    pub password: Option<String>,
    pub password_set: bool,
    pub receipt_markdown: String,
    pub published_at: String,
    pub expires_at: Option<String>,
}

impl GraphStore {
    pub fn record_share_history(
        &self,
        input: RecordShareHistoryInput,
    ) -> Result<ShareHistoryEntry, DbError> {
        let id = Uuid::new_v4().to_string();
        let created_at = Utc::now().to_rfc3339();
        let password_set = if input.password_set { 1 } else { 0 };
        self.conn.execute(
            "INSERT INTO share_history (
                id, workspace_id, workspace_name, token, url, password, password_set,
                receipt_markdown, published_at, expires_at, created_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
             ON CONFLICT(token) DO UPDATE SET
                workspace_id = excluded.workspace_id,
                workspace_name = excluded.workspace_name,
                url = excluded.url,
                password = excluded.password,
                password_set = excluded.password_set,
                receipt_markdown = excluded.receipt_markdown,
                published_at = excluded.published_at,
                expires_at = excluded.expires_at",
            params![
                id,
                input.workspace_id,
                input.workspace_name,
                input.token,
                input.url,
                input.password,
                password_set,
                input.receipt_markdown,
                input.published_at,
                input.expires_at,
                created_at,
            ],
        )?;

        self.get_share_history_by_token(&input.token)?
            .ok_or(DbError::NotFound)
    }

    pub fn list_share_history(
        &self,
        workspace_id: Option<&str>,
        limit: i64,
    ) -> Result<Vec<ShareHistoryEntry>, DbError> {
        let limit = limit.clamp(1, 500);
        if let Some(ws) = workspace_id {
            let mut stmt = self.conn.prepare(
                "SELECT id, workspace_id, workspace_name, token, url, password, password_set,
                        receipt_markdown, published_at, expires_at, created_at
                 FROM share_history
                 WHERE workspace_id = ?1
                 ORDER BY published_at DESC
                 LIMIT ?2",
            )?;
            let rows = stmt.query_map(params![ws, limit], map_share_row)?;
            return rows.collect::<Result<Vec<_>, _>>().map_err(Into::into);
        }

        let mut stmt = self.conn.prepare(
            "SELECT id, workspace_id, workspace_name, token, url, password, password_set,
                    receipt_markdown, published_at, expires_at, created_at
             FROM share_history
             ORDER BY published_at DESC
             LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit], map_share_row)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn delete_share_history(&self, id: &str) -> Result<bool, DbError> {
        let n = self
            .conn
            .execute("DELETE FROM share_history WHERE id = ?1", params![id])?;
        Ok(n > 0)
    }

    fn get_share_history_by_token(
        &self,
        token: &str,
    ) -> Result<Option<ShareHistoryEntry>, DbError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, workspace_id, workspace_name, token, url, password, password_set,
                    receipt_markdown, published_at, expires_at, created_at
             FROM share_history WHERE token = ?1",
        )?;
        let mut rows = stmt.query(params![token])?;
        if let Some(row) = rows.next()? {
            Ok(Some(map_share_row(row)?))
        } else {
            Ok(None)
        }
    }
}

fn map_share_row(row: &rusqlite::Row<'_>) -> Result<ShareHistoryEntry, rusqlite::Error> {
    let password_set: i64 = row.get(6)?;
    Ok(ShareHistoryEntry {
        id: row.get(0)?,
        workspace_id: row.get(1)?,
        workspace_name: row.get(2)?,
        token: row.get(3)?,
        url: row.get(4)?,
        password: row.get(5)?,
        password_set: password_set != 0,
        receipt_markdown: row.get(7)?,
        published_at: row.get(8)?,
        expires_at: row.get(9)?,
        created_at: row.get(10)?,
    })
}
