import "./App.css"
import TopMenu from "./components/Topmenu.jsx"
import WordCard from "./components/WordCard";
import { mockEntries } from "./data/mockEntries";

function App() {
    return (
        <div className="app">
            <TopMenu />

            <main className="page">
                <header className="page-header">
                    <p className="eyebrow">AI Vocabulary Notebook</p>
                    <h1>Vocabulary</h1>
                    <p className="page-description">
                        Search, review, and manage bilingual entries
                    </p>
                </header>

                <section className="controls">
                    <input type="text" placeholder="Search words..." />
                    
                    <select defaultValue="all">
                        <option value="all"> Language: All</option>
                        <option value="English">English</option>
                        <option value="Chinese">Chinese</option>
                    </select>

                    <select defaultValue="az">
                        <option value="az">Sort: A → Z</option>
                        <option value="za">Sort: Z → A</option>
                    </select>

                    <button className="add-button">+ Add Word</button>
                </section>

                <section className="word-grid">
                    {mockEntries.map((entry)=>(
                        <WordCard key={entry.id} entry={entry} />
                        ))}
                </section>
            </main>
        </div>
    );
}

export default App;