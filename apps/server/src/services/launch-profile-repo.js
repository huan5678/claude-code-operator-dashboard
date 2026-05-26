export class LaunchProfileRepo {
  constructor(db) { this.db = db; }

  list() {
    return this.db
      .prepare('SELECT * FROM launch_profiles ORDER BY name')
      .all()
      .map(this._normalise);
  }

  get(id) {
    const row = this.db.prepare('SELECT * FROM launch_profiles WHERE id = ?').get(id);
    return row ? this._normalise(row) : null;
  }

  create({ name, command, cwd, env = {} }) {
    if (!name) throw httpError(400, 'name required');
    if (!command) throw httpError(400, 'command required');
    if (!cwd) throw httpError(400, 'cwd required');
    try {
      const info = this.db
        .prepare('INSERT INTO launch_profiles (name, command, cwd, env_json) VALUES (?, ?, ?, ?)')
        .run(name, command, cwd, JSON.stringify(env || {}));
      return this.get(info.lastInsertRowid);
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) throw httpError(409, `name "${name}" already exists`);
      throw e;
    }
  }

  update(id, changes) {
    const cur = this.get(id);
    if (!cur) return null;
    const next = {
      name: changes.name ?? cur.name,
      command: changes.command ?? cur.command,
      cwd: changes.cwd ?? cur.cwd,
      env: changes.env ?? cur.env,
    };
    this.db
      .prepare(`UPDATE launch_profiles SET name=?, command=?, cwd=?, env_json=?, updated_at=datetime('now') WHERE id=?`)
      .run(next.name, next.command, next.cwd, JSON.stringify(next.env || {}), id);
    return this.get(id);
  }

  delete(id) {
    const info = this.db.prepare('DELETE FROM launch_profiles WHERE id = ?').run(id);
    return info.changes > 0;
  }

  _normalise(row) {
    return {
      ...row,
      env: row.env_json ? JSON.parse(row.env_json) : {},
      env_json: undefined,
    };
  }
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}
