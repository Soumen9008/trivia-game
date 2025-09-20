const TriviaGame = (() => {
    let state = {
        players: [{ name: '', score: 0 }, { name: '', score: 0 }],
        currentPlayer: 0,
        categories: [],
        usedCategories: new Set(),
        questions: [],
        questionIndex: 0,
        currentCategory: '',
        phase: 'setup',
        answering: false
    };

    const points = { easy: 10, medium: 15, hard: 20 };
    const apiUrl = 'https://the-trivia-api.com/v2';

    const dom = {
        get: (id) => document.getElementById(id),
        show: (id) => {
            document.querySelectorAll('.game-section').forEach(s => s.classList.remove('active'));
            const section = dom.get(id);
            if (section) section.classList.add('active');
        },
        escape: (text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    };

    const shuffle = (array) => {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    };

    const updateScores = () => {
        ['player1', 'player2'].forEach((player, idx) => {
            const nameEl = dom.get(`${player}-display`);
            const scoreEl = dom.get(`${player}-points`);
            if (nameEl) nameEl.textContent = state.players[idx].name;
            if (scoreEl) scoreEl.textContent = state.players[idx].score;
        });
    };

    const highlightActivePlayer = () => {
        const scores = [dom.get('player1-score'), dom.get('player2-score')];
        scores.forEach((el, idx) => {
            if (!el) return;
            el.classList.toggle('active', idx === state.currentPlayer);
        });
    };

    const validateNames = (name1, name2) => {
        if (!name1.trim() || !name2.trim()) {
            alert('Please enter names for both players!');
            return false;
        }
        if (name1 === name2) {
            alert('Players must have different names!');
            return false;
        }
        return true;
    };

    const startGame = async () => {
        const name1 = dom.get('player1-name')?.value.trim() || '';
        const name2 = dom.get('player2-name')?.value.trim() || '';
        
        if (!validateNames(name1, name2)) return;

        state.players[0].name = name1;
        state.players[1].name = name2;
        state.phase = 'category';
        
        updateScores();
        await loadCategories();
        dom.show('category-selection');
    };

    const loadCategories = async () => {
        try {
            const response = await fetch(`${apiUrl}/categories`);
            if (!response.ok) throw new Error('Network error');
            
            const data = await response.json();
            state.categories = Object.entries(data).map(([id, name]) => ({ id, name }));
            displayCategories();
        } catch (error) {
            showError('Failed to load categories', () => loadCategories());
        }
    };

    const displayCategories = () => {
        const container = dom.get('categories-container');
        if (!container) return;

        const available = state.categories.filter(cat => !state.usedCategories.has(cat.id));
        if (available.length === 0) {
            endGame();
            return;
        }

        const html = available.map(cat => 
            `<div class="category-btn" data-id="${dom.escape(cat.id)}" data-name="${dom.escape(cat.name)}">
                ${dom.escape(cat.name)}
            </div>`
        ).join('');

         container.innerHTML = `
        <div class="categories-grid">${html}</div>
        <div class="game-controls">
            <button class="btn" onclick="quitGame()">Quit Game</button>
        </div>
    `;
    };

    const selectCategory = async (categoryId, categoryName) => {
        state.currentCategory = categoryName;
        state.usedCategories.add(categoryId);
        
        const container = dom.get('categories-container');
        if (container) {
            container.innerHTML = `<div class="loading"><div class="spinner"></div><p>Loading questions...</p></div>`;
        }

        try {
            const difficulties = ['easy', 'medium', 'hard'];
            const promises = difficulties.map(diff => 
                fetch(`${apiUrl}/questions?categories=${categoryId}&difficulties=${diff}&limit=2`)
                    .then(res => res.ok ? res.json() : Promise.reject())
            );

            const results = await Promise.all(promises);
            state.questions = results.flat();
            state.questionIndex = 0;
            state.currentPlayer = 0;
            state.phase = 'playing';

            dom.show('gameplay');
            showQuestion();
        } catch (error) {
            showError('Failed to load questions', displayCategories);
        }
    };

    const showQuestion = () => {
        const question = state.questions[state.questionIndex];
        if (!question) return;

        const playerName = state.players[state.currentPlayer].name;
        highlightActivePlayer();

        const answers = shuffle([...question.incorrectAnswers, question.correctAnswer]);
        const container = dom.get('question-container');
        
        if (container) {
            container.innerHTML = `
                <div class="question-meta">
                    <div><strong>${dom.escape(playerName)}'s Turn</strong></div>
                    <div class="difficulty ${question.difficulty}">${question.difficulty}</div>
                </div>
                <div class="question-text">${dom.escape(question.question.text)}</div>
                <div class="answers-grid">
                    ${answers.map(answer => 
                        `<button class="answer-btn" data-answer="${dom.escape(answer)}">
                            ${dom.escape(answer)}
                        </button>`
                    ).join('')}
                </div>
            `;
        }

        const controls = dom.get('question-controls');
        if (controls) controls.style.display = 'none';
        
        state.answering = true;
    };

    const handleAnswer = (selectedAnswer) => {
        if (!state.answering) return;
        
        state.answering = false;
        const question = state.questions[state.questionIndex];
        const correct = selectedAnswer === question.correctAnswer;

        if (correct) {
            state.players[state.currentPlayer].score += points[question.difficulty];
            updateScores();
        }

        document.querySelectorAll('.answer-btn').forEach(btn => {
            btn.disabled = true;
            const answer = btn.dataset.answer;
            if (answer === question.correctAnswer) {
                btn.classList.add('correct');
            } else if (answer === selectedAnswer && !correct) {
                btn.classList.add('incorrect');
            }
        });

        setTimeout(() => {
            if (state.questionIndex < state.questions.length - 1) {
                const controls = dom.get('question-controls');
                if (controls) controls.style.display = 'block';
            } else {
                setTimeout(checkContinue, 2000);
            }
        }, 1500);
    };

    const nextQuestion = () => {
        state.questionIndex++;
        state.currentPlayer = 1 - state.currentPlayer;
        showQuestion();
    };

    const checkContinue = () => {
        const available = state.categories.filter(cat => !state.usedCategories.has(cat.id));
        
        if (available.length === 0) {
            endGame();
        } else {
            const formattedCategory = state.currentCategory
                .replace(/_/g, ' ')  
                .replace(/,/g, ', ') 
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1)) 
                .join(' ');
                
            const proceed = confirm(`Category "${formattedCategory}" completed!\n\nPlay another category?`);
            if (proceed) {
                state.phase = 'category';
                displayCategories();
                dom.show('category-selection');
            } else {
                endGame();
            }
        }
    };

    const endGame = () => {
        state.phase = 'finished';
        const [p1, p2] = state.players;
        
        let winner = "It's a Tie!";
        let p1Winner = false, p2Winner = false;
        
        if (p1.score > p2.score) {
            winner = `${p1.name} Wins!`;
            p1Winner = true;
        } else if (p2.score > p1.score) {
            winner = `${p2.name} Wins!`;
            p2Winner = true;
        }

        const elements = {
            winner: dom.get('winner-text'),
            p1Final: dom.get('final-player1'),
            p2Final: dom.get('final-player2'),
            p1Name: dom.get('final-player1-name'),
            p1Points: dom.get('final-player1-points'),
            p2Name: dom.get('final-player2-name'),
            p2Points: dom.get('final-player2-points')
        };

        if (elements.winner) elements.winner.textContent = winner;
        if (elements.p1Final) elements.p1Final.classList.toggle('winner', p1Winner);
        if (elements.p2Final) elements.p2Final.classList.toggle('winner', p2Winner);
        if (elements.p1Name) elements.p1Name.textContent = p1.name;
        if (elements.p1Points) elements.p1Points.textContent = p1.score;
        if (elements.p2Name) elements.p2Name.textContent = p2.name;
        if (elements.p2Points) elements.p2Points.textContent = p2.score;

        dom.show('game-end');
    };

    const restart = () => {
        state = {
            players: [{ name: '', score: 0 }, { name: '', score: 0 }],
            currentPlayer: 0,
            categories: state.categories,
            usedCategories: new Set(),
            questions: [],
            questionIndex: 0,
            currentCategory: '',
            phase: 'setup',
            answering: false
        };

        ['player1-name', 'player2-name'].forEach(id => {
            const input = dom.get(id);
            if (input) input.value = '';
        });

        dom.show('player-setup');
    };

    const showError = (message, retryFn) => {
        const container = dom.get('categories-container');
        if (container) {
            container.innerHTML = `
                <div class="error-message">
                    ${message}. Please check your connection.
                    <br><br>
                    <button class="btn" onclick="triviaGame.retry()">Retry</button>
                </div>
            `;
        }
        state.retryFn = retryFn;
    };

    // Event delegation and initialization
    document.addEventListener('DOMContentLoaded', () => {
        ['player1-name', 'player2-name'].forEach((id, idx) => {
            const input = dom.get(id);
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        if (idx === 0) {
                            dom.get('player2-name')?.focus();
                        } else {
                            startGame();
                        }
                    }
                });
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('category-btn')) {
                const id = e.target.dataset.id;
                const name = e.target.dataset.name;
                selectCategory(id, name);
            }
            
            if (e.target.classList.contains('answer-btn')) {
                const answer = e.target.dataset.answer;
                handleAnswer(answer);
            }
        });
    });

    const quitGame = () => {
        restart();
    };

    const playAnotherCategory = () => {
        const available = state.categories.filter(cat => !state.usedCategories.has(cat.id));
        
        if (available.length === 0) {
            restart();
        } else {
            state.phase = 'category';
            displayCategories();
            dom.show('category-selection');
        }
    };

    // Public API
    window.startGame = startGame;
    window.nextQuestion = nextQuestion;
    window.restartGame = restart;
    window.selectCategory = selectCategory;
    window.quitGame = quitGame;
    window.playAnotherCategory = playAnotherCategory;
    
    return { start: startGame, next: nextQuestion, restart, retry: () => state.retryFn?.() };
})();

const triviaGame = TriviaGame;