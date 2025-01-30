import { Command, CommandHistory } from './CommandHistory.js';

export class PaintCommand extends Command {
    constructor(image, startImageData, endImageData) {
        super();
        this.image = image;
        this.startImageData = startImageData;
        this.endImageData = endImageData;
    }

    execute() {
        this.image.paintCtx.putImageData(this.endImageData, 0, 0);
    }

    undo() {
        this.image.paintCtx.putImageData(this.startImageData, 0, 0);
    }
}

export class CommandManager {
    constructor(app) {
        this.app = app;
        this.commandHistory = new CommandHistory();
        this.setupKeyboardShortcuts();
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Check if target is an input field
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
                if (e.shiftKey) {
                    // Ctrl/Cmd + Shift + Z = Redo
                    e.preventDefault();
                    this.redo();
                } else {
                    // Ctrl/Cmd + Z = Undo
                    e.preventDefault();
                    this.undo();
                }
            } else if (e.key === 'y' && (e.ctrlKey || e.metaKey)) {
                // Ctrl/Cmd + Y = Redo (alternative)
                e.preventDefault();
                this.redo();
            }
        });
    }

    execute(command) {
        this.commandHistory.execute(command);
    }

    undo() {
        this.commandHistory.undo();
        this.app.scheduleRedraw();
    }

    redo() {
        this.commandHistory.redo();
        this.app.scheduleRedraw();
    }
}