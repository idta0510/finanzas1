const DB_NAME = "finanzas_pwa_v3";
const DB_VERSION = 1;

const STORE_MOV = "movements";
const STORE_BUD = "budgets"; // key: [year, month, category]

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = () => {
            const db = req.result;

            if (!db.objectStoreNames.contains(STORE_MOV)) {
                const s = db.createObjectStore(STORE_MOV, { keyPath: "id", autoIncrement: true });
                s.createIndex("by_year", "year", { unique: false });
                s.createIndex("by_year_month", ["year", "month"], { unique: false });
                s.createIndex("by_year_month_type", ["year", "month", "type"], { unique: false });
            }

            if (!db.objectStoreNames.contains(STORE_BUD)) {
                const b = db.createObjectStore(STORE_BUD, { keyPath: "key" }); // key = `${year}-${month}-${category}`
                b.createIndex("by_year_month", ["year", "month"], { unique: false });
            }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function txDone(tx) {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

// ---------- MOVEMENTS ----------
export async function addMovement(m) {
    const db = await openDB();
    const tx = db.transaction(STORE_MOV, "readwrite");
    tx.objectStore(STORE_MOV).add(m);
    await txDone(tx);
    db.close();
}

export async function deleteMovement(id) {
    const db = await openDB();
    const tx = db.transaction(STORE_MOV, "readwrite");
    tx.objectStore(STORE_MOV).delete(id);
    await txDone(tx);
    db.close();
}

export async function getMovementsByYearMonth(year, month) {
    const db = await openDB();
    const tx = db.transaction(STORE_MOV, "readonly");
    const idx = tx.objectStore(STORE_MOV).index("by_year_month");
    const req = idx.getAll([year, month]);

    const rows = await new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });

    await txDone(tx);
    db.close();
    return rows;
}

export async function getAllMovementsByYear(year) {
    const db = await openDB();
    const tx = db.transaction(STORE_MOV, "readonly");
    const idx = tx.objectStore(STORE_MOV).index("by_year");
    const req = idx.getAll(year);

    const rows = await new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });

    await txDone(tx);
    db.close();
    return rows;
}

// ---------- BUDGETS ----------
export async function setBudget(year, month, category, amount) {
    const db = await openDB();
    const tx = db.transaction(STORE_BUD, "readwrite");
    const store = tx.objectStore(STORE_BUD);

    const key = `${year}-${month}-${category}`;
    store.put({
        key,
        year,
        month,
        category,
        amount: Number(amount) || 0,
        updatedAt: new Date().toISOString()
    });

    await txDone(tx);
    db.close();
}

export async function getBudgetsByYearMonth(year, month) {
    const db = await openDB();
    const tx = db.transaction(STORE_BUD, "readonly");
    const idx = tx.objectStore(STORE_BUD).index("by_year_month");
    const req = idx.getAll([year, month]);

    const rows = await new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });

    await txDone(tx);
    db.close();
    return rows;
}

export async function exportYearToJSON(year) {
    const [movs, budsJan] = await Promise.all([
        getAllMovementsByYear(year),
        // budgets están por mes, pero exportaremos todos los meses del año consultando directo:
        (async () => {
            const all = [];
            for (let i = 1; i <= 12; i++) {
                const m = String(i).padStart(2, "0");
                const rows = await getBudgetsByYearMonth(year, m);
                all.push(...rows);
            }
            return all;
        })()
    ]);

    return {
        schema: "finanzas_pwa_v3",
        year,
        exportedAt: new Date().toISOString(),
        movements: movs,
        budgets: budsJan
    };
}

export async function importFromJSON(payload) {
    if (!payload || payload.schema !== "finanzas_pwa_v3") {
        throw new Error("Archivo inválido (schema no coincide).");
    }
    const movements = Array.isArray(payload.movements) ? payload.movements : [];
    const budgets = Array.isArray(payload.budgets) ? payload.budgets : [];

    const db = await openDB();

    // Insertar como nuevos registros (movimientos sin respetar IDs)
    {
        const tx = db.transaction(STORE_MOV, "readwrite");
        const store = tx.objectStore(STORE_MOV);

        for (const m of movements) {
            store.add({
                date: m.date,
                year: Number(m.year),
                month: m.month,
                type: m.type,
                category: m.category,
                description: m.description || "",
                amount: Number(m.amount) || 0,
                createdAt: m.createdAt || new Date().toISOString()
            });
        }
        await txDone(tx);
    }

    // Budgets: upsert por key
    {
        const tx = db.transaction(STORE_BUD, "readwrite");
        const store = tx.objectStore(STORE_BUD);

        for (const b of budgets) {
            const year = Number(b.year);
            const month = b.month;
            const category = b.category;
            const amount = Number(b.amount) || 0;
            const key = `${year}-${month}-${category}`;

            store.put({
                key, year, month, category, amount,
                updatedAt: b.updatedAt || new Date().toISOString()
            });
        }
        await txDone(tx);
    }

    db.close();
}