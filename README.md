# Plan — setup

## 1. Turso
```
curl -sSfL https://get.tur.so/install.sh | bash   # sau: brew install tursodatabase/tap/turso
turso auth login
turso db create plan
turso db show plan --url                            # -> VITE_TURSO_DATABASE_URL
turso db tokens create plan --expiration 30d        # -> VITE_TURSO_AUTH_TOKEN
```
Schema se creează automat la prima deschidere (`initSchema`); opțional: `turso db shell plan < schema.sql`.

## 2. Local
```
cp .env.example .env.local   # completează valorile
npm install && npm run dev
```

## 3. GitHub Pages
1. Creează repo, `git push` pe `main`.
2. Settings → Secrets → Actions: `VITE_TURSO_DATABASE_URL`, `VITE_TURSO_AUTH_TOKEN`.
3. Settings → Pages → Source: **GitHub Actions**.
4. Site: `https://USER.github.io/REPO/` → „Adaugă pe ecranul principal".

Fără router (navigare prin tab-uri) + `404.html` = fără erori de routing SPA.

## ⚠️ Securitate
Variabilele `VITE_*` ajung în bundle-ul JS public: oricine deschide site-ul poate extrage tokenul. `robots.txt`/noindex doar ascund pagina din căutări. Folosește un DB dedicat, token cu expirare și rotește-l; pentru protecție reală adaugă un proxy/API cu autentificare.
