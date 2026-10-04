# SchoolHub V2

Clean-slate rebuild. See `docs/V2_ARCHITECTURE.md`.

```
createdb schoolhub_v2           # PostgreSQL; never the old SchoolHub database
npm install                     # from v2/
npm run dev:server              # http://127.0.0.1:4020 (applies migrations on start)
npm run dev:frontend            # http://127.0.0.1:5173
npm test                        # unit + real-PostgreSQL integration tests (needs schoolhub_v2_test)
node e2e/foundation.e2e.cjs     # real-browser proof (needs an EMPTY schoolhub_v2 and both servers running)
```
First run: open the frontend → "First server setup".
