export class KanbanRepo {
  constructor(db) {
    this.db = db;
  }

  listColumns() {
    return this.db
      .prepare('SELECT id, name, position FROM kanban_columns ORDER BY position')
      .all();
  }

  listCards({ columnId = null } = {}) {
    const rows = columnId
      ? this.db
          .prepare(
            'SELECT * FROM kanban_cards WHERE column_id = ? ORDER BY position'
          )
          .all(columnId)
      : this.db
          .prepare('SELECT * FROM kanban_cards ORDER BY column_id, position')
          .all();
    return rows.map(this._normalise);
  }

  getCard(id) {
    const row = this.db.prepare('SELECT * FROM kanban_cards WHERE id = ?').get(id);
    return row ? this._normalise(row) : null;
  }

  createCard({ title, description = null, columnId = null, columnName = null, tags = [] }) {
    if (!title) throw new Error('title required');
    const resolvedColumnId =
      columnId ?? this._resolveColumnByName(columnName ?? 'Todo');
    const maxPos = this.db
      .prepare('SELECT COALESCE(MAX(position), -1) AS p FROM kanban_cards WHERE column_id = ?')
      .get(resolvedColumnId).p;
    const stmt = this.db.prepare(`
      INSERT INTO kanban_cards (column_id, title, description, position, tags)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      resolvedColumnId,
      title,
      description,
      maxPos + 1,
      JSON.stringify(tags ?? []),
    );
    return this.getCard(info.lastInsertRowid);
  }

  updateCard(id, changes) {
    const card = this.getCard(id);
    if (!card) return null;

    let targetColumnId = card.column_id;
    let targetPosition = card.position;

    if (changes.columnId != null || changes.columnName != null) {
      targetColumnId = changes.columnId ?? this._resolveColumnByName(changes.columnName);
    }

    if (changes.position != null) {
      targetPosition = changes.position;
    } else if (targetColumnId !== card.column_id) {
      const maxPos = this.db
        .prepare('SELECT COALESCE(MAX(position), -1) AS p FROM kanban_cards WHERE column_id = ?')
        .get(targetColumnId).p;
      targetPosition = maxPos + 1;
    }

    const tx = this.db.transaction(() => {
      if (targetColumnId !== card.column_id || targetPosition !== card.position) {
        this._removeFromColumn(card.id, card.column_id, card.position);
        this._insertIntoColumn(card.id, targetColumnId, targetPosition);
      }

      const fields = [];
      const params = [];
      if (changes.title !== undefined) { fields.push('title = ?'); params.push(changes.title); }
      if (changes.description !== undefined) { fields.push('description = ?'); params.push(changes.description); }
      if (changes.tags !== undefined) { fields.push('tags = ?'); params.push(JSON.stringify(changes.tags ?? [])); }
      fields.push("updated_at = datetime('now')");
      params.push(id);
      this.db.prepare(`UPDATE kanban_cards SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    });
    tx();
    return this.getCard(id);
  }

  deleteCard(id) {
    const card = this.getCard(id);
    if (!card) return false;
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM kanban_cards WHERE id = ?').run(id);
      this.db
        .prepare(
          'UPDATE kanban_cards SET position = position - 1 WHERE column_id = ? AND position > ?'
        )
        .run(card.column_id, card.position);
    });
    tx();
    return true;
  }

  _removeFromColumn(cardId, columnId, position) {
    this.db
      .prepare(
        'UPDATE kanban_cards SET position = position - 1 WHERE column_id = ? AND position > ?'
      )
      .run(columnId, position);
  }

  _insertIntoColumn(cardId, columnId, position) {
    this.db
      .prepare(
        'UPDATE kanban_cards SET position = position + 1 WHERE column_id = ? AND position >= ? AND id != ?'
      )
      .run(columnId, position, cardId);
    this.db
      .prepare('UPDATE kanban_cards SET column_id = ?, position = ? WHERE id = ?')
      .run(columnId, position, cardId);
  }

  _resolveColumnByName(name) {
    const row = this.db.prepare('SELECT id FROM kanban_columns WHERE name = ?').get(name);
    if (!row) throw new Error(`unknown column: ${name}`);
    return row.id;
  }

  _normalise(row) {
    return {
      ...row,
      tags: row.tags ? JSON.parse(row.tags) : [],
    };
  }
}
