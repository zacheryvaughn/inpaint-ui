export class Command {
    execute() {
        throw new Error('Command.execute() must be implemented');
    }

    undo() {
        throw new Error('Command.undo() must be implemented');
    }
}

export class CommandHistory {
    constructor() {
        this.undoStack = [];
        this.redoStack = [];
    }

    execute(command) {
        command.execute();
        this.undoStack.push(command);
        // Clear redo stack when new command is executed
        this.redoStack = [];
    }

    undo() {
        if (this.undoStack.length === 0) return;
        
        const command = this.undoStack.pop();
        command.undo();
        this.redoStack.push(command);
    }

    redo() {
        if (this.redoStack.length === 0) return;
        
        const command = this.redoStack.pop();
        command.execute();
        this.undoStack.push(command);
    }

    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }

    canUndo() {
        return this.undoStack.length > 0;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }
}