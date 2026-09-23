# Vocabulary Notebook

A small place to collect words and practise remembering them. The browser app has a daily view, a searchable library, practice cards, and a progress page. It starts with sample English and Chinese words so you can try it straight away.

## Run the app

You'll need Node.js and npm. From the `ui` folder:

```sh
cd ui
npm ci
npm run dev
```

Open the local address Vite prints in the terminal. For a production build, run `npm run build` from the same folder.

Words you add or edit in the browser are saved in that browser's local storage. Clearing site data will remove them. There is no account or sync service.

## What's in the repo

- `ui/` is the React app. Its own [README](ui/README.md) has the keyboard shortcuts and notes on the interface.
- `sqlite_section/` is a separate Python and SQLite command-line prototype. Run `python main.py` from that folder to try its menu. It uses a local `notebook.db` file and is not connected to the browser app.
- `ui/design-concepts/` contains reference images for the main screens.

The browser app is the easiest place to start. The SQLite code is here for experimenting with a database-backed version.
