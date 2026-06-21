import { readdir, readFile, writeFile, stat, rename } from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
import { join, resolve, basename, dirname, relative, sep } from 'node:path';
import matter from 'gray-matter';

// 單檔預覽上限：超過就只回 metadata 不回內容，避免把大檔（embedding json、log）整包丟前端
const SKILL_FILE_MAX_BYTES = 512 * 1024;

// 掃前 8KB 有 NUL byte 就當 binary（圖片 / 編譯產物），前端不嘗試 render
function looksBinary(buf) {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

export const IDENTITY_FILES = [
  'CLAUDE.md',
  'IDENTITY.md',
  'SOUL.md',
  'USER.md',
  'MEMORY.md',
];

const SLUG_RE = /^[A-Za-z0-9_-]{1,64}$/;

function assertSafeSlug(slug) {
  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) {
    const err = new Error(`invalid slug: ${slug}`);
    err.status = 400;
    err.code = 'INVALID_SLUG';
    throw err;
  }
  return slug;
}

export class ChannelReader {
  constructor(channelPath) {
    if (!channelPath) throw new Error('CHANNEL_PATH is required');
    this.root = resolve(channelPath);
    if (!existsSync(this.root)) {
      throw new Error(`CHANNEL_PATH does not exist: ${this.root}`);
    }
  }

  _skillsDir() { return join(this.root, '.claude', 'skills'); }
  _agentsDir() { return join(this.root, '.claude', 'agents'); }
  _tasksDir() { return join(this.root, 'tasks'); }
  _memoryDir() { return join(this.root, 'memory'); }

  async listSkills() {
    const dir = this._skillsDir();
    if (!existsSync(dir)) return [];
    const entries = await readdir(dir, { withFileTypes: true });
    const skills = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillFile = join(dir, entry.name, 'SKILL.md');
      if (!existsSync(skillFile)) continue;
      const raw = await readFile(skillFile, 'utf8');
      const parsed = matter(raw);
      const st = await stat(skillFile);
      skills.push({
        name: parsed.data.name ?? entry.name,
        slug: entry.name,
        description: parsed.data.description ?? '',
        triggers_zh: parsed.data.triggers_zh ?? [],
        triggers_en: parsed.data.triggers_en ?? [],
        model: parsed.data.model ?? null,
        context: parsed.data.context ?? null,
        'disable-model-invocation': parsed.data['disable-model-invocation'] ?? false,
        'user-invocable': parsed.data['user-invocable'] ?? true,
        mtime: st.mtimeMs,
      });
    }
    return skills.sort((a, b) => a.slug.localeCompare(b.slug));
  }

  async getSkill(slug) {
    assertSafeSlug(slug);
    const file = join(this._skillsDir(), slug, 'SKILL.md');
    if (!existsSync(file)) return null;
    const raw = await readFile(file, 'utf8');
    const parsed = matter(raw);
    const st = await stat(file);
    return {
      slug,
      path: file,
      frontmatter: parsed.data,
      body: parsed.content,
      raw,
      mtime: st.mtimeMs,
    };
  }

  async saveSkill(slug, { frontmatter, body, expectedMtime }) {
    assertSafeSlug(slug);
    const file = join(this._skillsDir(), slug, 'SKILL.md');
    if (!existsSync(file)) throw new Error(`skill not found: ${slug}`);
    await this._safeWrite(file, frontmatter, body, expectedMtime);
    return this.getSkill(slug);
  }

  // 列出 skill 目錄底下的完整檔案樹（含 reference/ 等子目錄）。
  // 回傳 flat 陣列（dir + file），依 path 排序，前端自行縮排成樹。
  // skill 不存在回 null（caller 應回 404）。
  async listSkillFiles(slug) {
    assertSafeSlug(slug);
    const base = join(this._skillsDir(), slug);
    if (!existsSync(base)) return null;
    const out = [];
    await this._walkSkillDir(base, base, out, 0);
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }

  async _walkSkillDir(base, dir, out, depth) {
    if (depth > 8) return; // 防呆：避免極端巢狀 / symlink 迴圈
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch { return; }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue; // 跳過 dotfile / .tmp
      const full = join(dir, entry.name);
      const rel = relative(base, full);
      if (entry.isDirectory()) {
        out.push({ path: rel, type: 'dir' });
        await this._walkSkillDir(base, full, out, depth + 1);
      } else if (entry.isFile()) {
        let st;
        try { st = await stat(full); } catch { continue; }
        out.push({ path: rel, type: 'file', size: st.size, mtime: st.mtimeMs });
      }
    }
  }

  // 讀 skill 目錄下單一檔案（相對路徑）。含 path-traversal 防護：
  // resolve 後必須仍落在 skill 目錄內，否則拋 400。
  // binary / 過大檔只回 metadata 不回內容。檔案不存在回 null。
  async getSkillFile(slug, relPath) {
    assertSafeSlug(slug);
    if (typeof relPath !== 'string' || !relPath) {
      const err = new Error('path required');
      err.status = 400; err.code = 'INVALID_PATH';
      throw err;
    }
    const base = resolve(this._skillsDir(), slug);
    const target = resolve(base, relPath);
    if (target !== base && !target.startsWith(base + sep)) {
      const err = new Error('path escapes skill directory');
      err.status = 400; err.code = 'INVALID_PATH';
      throw err;
    }
    if (!existsSync(target)) return null;
    // resolve() 只做字串運算、不解 symlink。再用 realpath 解出真實路徑，
    // 擋掉 skill 目錄內的 symlink 逃逸（如 evil -> /etc 後讀 evil/passwd）。
    let realBase, realTarget;
    try {
      realBase = realpathSync(base);
      realTarget = realpathSync(target);
    } catch { return null; }
    if (realTarget !== realBase && !realTarget.startsWith(realBase + sep)) {
      const err = new Error('path escapes skill directory');
      err.status = 400; err.code = 'INVALID_PATH';
      throw err;
    }
    const st = await stat(target);
    if (!st.isFile()) return null;
    const meta = { path: relPath, size: st.size, mtime: st.mtimeMs };
    if (st.size > SKILL_FILE_MAX_BYTES) {
      // 過大不讀內容 → 無法判定是否 binary，用 null 表「未知」
      return { ...meta, binary: null, tooLarge: true, content: '' };
    }
    const buf = await readFile(target);
    const binary = looksBinary(buf);
    return {
      ...meta,
      binary,
      tooLarge: false,
      content: binary ? '' : buf.toString('utf8'),
    };
  }

  async listAgents() {
    const dir = this._agentsDir();
    if (!existsSync(dir)) return [];
    const files = (await readdir(dir)).filter(f => f.endsWith('.md'));
    const agents = [];
    for (const file of files) {
      const full = join(dir, file);
      const raw = await readFile(full, 'utf8');
      const parsed = matter(raw);
      const st = await stat(full);
      agents.push({
        name: parsed.data.name ?? basename(file, '.md'),
        slug: basename(file, '.md'),
        description: parsed.data.description ?? '',
        model: parsed.data.model ?? null,
        color: parsed.data.color ?? null,
        tools: parsed.data.tools ?? [],
        background: parsed.data.background ?? false,
        isolation: parsed.data.isolation ?? null,
        permissionMode: parsed.data.permissionMode ?? null,
        effort: parsed.data.effort ?? null,
        mtime: st.mtimeMs,
      });
    }
    return agents.sort((a, b) => a.slug.localeCompare(b.slug));
  }

  async getAgent(slug) {
    assertSafeSlug(slug);
    const file = join(this._agentsDir(), `${slug}.md`);
    if (!existsSync(file)) return null;
    const raw = await readFile(file, 'utf8');
    const parsed = matter(raw);
    const st = await stat(file);
    return {
      slug,
      path: file,
      frontmatter: parsed.data,
      body: parsed.content,
      raw,
      mtime: st.mtimeMs,
    };
  }

  async saveAgent(slug, { frontmatter, body, expectedMtime }) {
    assertSafeSlug(slug);
    const file = join(this._agentsDir(), `${slug}.md`);
    if (!existsSync(file)) throw new Error(`agent not found: ${slug}`);
    await this._safeWrite(file, frontmatter, body, expectedMtime);
    return this.getAgent(slug);
  }

  async listTasks() {
    const dir = this._tasksDir();
    if (!existsSync(dir)) return [];
    const files = (await readdir(dir)).filter(f => f.endsWith('.md'));
    const tasks = [];
    for (const file of files) {
      const full = join(dir, file);
      const raw = await readFile(full, 'utf8');
      const parsed = matter(raw);
      const st = await stat(full);
      tasks.push({
        name: parsed.data.name ?? basename(file, '.md'),
        slug: basename(file, '.md'),
        schedule: parsed.data.schedule ?? null,
        enabled: parsed.data.enabled ?? null,
        channel: parsed.data.channel ?? null,
        mtime: st.mtimeMs,
      });
    }
    return tasks.sort((a, b) => a.slug.localeCompare(b.slug));
  }

  async getTask(slug) {
    assertSafeSlug(slug);
    const file = join(this._tasksDir(), `${slug}.md`);
    if (!existsSync(file)) return null;
    const raw = await readFile(file, 'utf8');
    const parsed = matter(raw);
    const st = await stat(file);
    return {
      slug,
      path: file,
      frontmatter: parsed.data,
      body: parsed.content,
      raw,
      mtime: st.mtimeMs,
    };
  }

  async saveTask(slug, { frontmatter, body, expectedMtime }) {
    assertSafeSlug(slug);
    const file = join(this._tasksDir(), `${slug}.md`);
    if (!existsSync(file)) throw new Error(`task not found: ${slug}`);
    await this._safeWrite(file, frontmatter, body, expectedMtime);
    return this.getTask(slug);
  }

  async listMemoryDays({ limit = null } = {}) {
    const dir = this._memoryDir();
    if (!existsSync(dir)) return [];
    const files = (await readdir(dir))
      .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort()
      .reverse();
    const sliced = limit ? files.slice(0, limit) : files;
    const out = [];
    for (const file of sliced) {
      const full = join(dir, file);
      const st = await stat(full);
      out.push({
        date: basename(file, '.md'),
        mtime: st.mtimeMs,
        size: st.size,
      });
    }
    return out;
  }

  async getMemoryDay(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('invalid date format');
    const file = join(this._memoryDir(), `${date}.md`);
    if (!existsSync(file)) return null;
    const raw = await readFile(file, 'utf8');
    const parsed = matter(raw);
    const st = await stat(file);
    return {
      date,
      path: file,
      frontmatter: parsed.data,
      body: parsed.content,
      raw,
      mtime: st.mtimeMs,
    };
  }

  async listIdentityFiles() {
    const out = [];
    for (const name of IDENTITY_FILES) {
      const file = join(this.root, name);
      if (!existsSync(file)) continue;
      const st = await stat(file);
      out.push({ name, path: file, mtime: st.mtimeMs, size: st.size });
    }
    return out;
  }

  async getIdentityFile(name) {
    if (!IDENTITY_FILES.includes(name)) return null;
    const file = join(this.root, name);
    if (!existsSync(file)) return null;
    const raw = await readFile(file, 'utf8');
    const st = await stat(file);
    return {
      name,
      path: file,
      body: raw,
      mtime: st.mtimeMs,
    };
  }

  async saveIdentityFile(name, { body, expectedMtime }) {
    if (!IDENTITY_FILES.includes(name)) {
      const err = new Error(`identity file not allowed: ${name}`);
      err.code = 'NOT_ALLOWED';
      throw err;
    }
    const file = join(this.root, name);
    if (!existsSync(file)) {
      const err = new Error(`identity file not found: ${name}`);
      err.code = 'NOT_FOUND';
      throw err;
    }
    await this._safeWritePlain(file, body ?? '', expectedMtime);
    return this.getIdentityFile(name);
  }

  async _safeWritePlain(file, body, expectedMtime) {
    if (expectedMtime != null) {
      const st = await stat(file);
      const diff = Math.abs(st.mtimeMs - Number(expectedMtime));
      if (diff > 5) {
        const err = new Error('CONFLICT: file changed since last read');
        err.code = 'CONFLICT';
        throw err;
      }
    }
    const tmp = join(dirname(file), `.${basename(file)}.tmp`);
    await writeFile(tmp, body, 'utf8');
    await rename(tmp, file);
  }

  async _safeWrite(file, frontmatter, body, expectedMtime) {
    if (expectedMtime != null) {
      const st = await stat(file);
      const diff = Math.abs(st.mtimeMs - Number(expectedMtime));
      if (diff > 5) {
        const err = new Error('CONFLICT: file changed since last read');
        err.code = 'CONFLICT';
        throw err;
      }
    }
    const composed = matter.stringify(body ?? '', frontmatter ?? {});
    const tmp = join(dirname(file), `.${basename(file)}.tmp`);
    await writeFile(tmp, composed, 'utf8');
    await rename(tmp, file);
  }
}
