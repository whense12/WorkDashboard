"""Standalone demonstration of the C6 backup claim, printing real numbers.

Run: python3 demo_backup.py
"""
import os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import db, snapshot

with tempfile.TemporaryDirectory() as tmp:
    path = os.path.join(tmp, "spike.db")
    conn = db.init_current(path)
    for i in range(5):
        conn.execute("INSERT INTO vendor (name) VALUES (?)", ("seed%d" % i,))
    conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    conn.execute("PRAGMA wal_autocheckpoint = 0")
    for i in range(7):
        conn.execute("INSERT INTO vendor (name) VALUES (?)", ("late%d" % i,))

    live = conn.execute("SELECT COUNT(*) FROM vendor").fetchone()[0]
    naive = snapshot.inspect(snapshot.naive_file_copy(path, os.path.join(tmp, "naive.db")))
    back = snapshot.inspect(snapshot.online_backup(conn, os.path.join(tmp, "backup.db")))
    rest = snapshot.inspect(snapshot.restore(os.path.join(tmp, "backup.db"),
                                             os.path.join(tmp, "restored.db")))

    print("live database       vendor rows =", live,
          " wal bytes =", os.path.getsize(path + "-wal"))
    print("naive file copy     vendor rows =", naive["row_counts"]["vendor"],
          " integrity =", naive["integrity_check"],
          " digest matches live =", naive["digest"] == snapshot.digest(conn))
    print("online backup API   vendor rows =", back["row_counts"]["vendor"],
          " integrity =", back["integrity_check"],
          " digest matches live =", back["digest"] == snapshot.digest(conn))
    print("restored from backup vendor rows =", rest["row_counts"]["vendor"],
          " integrity =", rest["integrity_check"],
          " fk_check =", rest["foreign_key_check"],
          " digest matches live =", rest["digest"] == snapshot.digest(conn))
    conn.close()
