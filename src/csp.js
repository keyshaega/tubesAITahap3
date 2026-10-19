class CSPEngine {
    constructor(gridWidth, gridHeight, obstacles) {
        this.width = gridWidth;
        this.height = gridHeight;
        this.obstacles = obstacles; // Set berisi string 'x,y'
        this.steps = 0;
        this.backtracks = 0;
    }

    setupProblem(enemiesCount, itemsCount) {
        let variables = [];
        for (let i = 0; i < enemiesCount; i++) variables.push(`E${i}`);
        for (let i = 0; i < itemsCount; i++) variables.push(`I${i}`);

        let domains = {};
        let allCoords = [];
        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                if (!this.obstacles.has(`${x},${y}`)) allCoords.push(`${x},${y}`);
            }
        }
        
        variables.forEach(v => domains[v] = [...allCoords]);
        return { variables, domains };
    }

    isConsistent(variable, value, assignment) {
        let [vx, vy] = value.split(',').map(Number);
        
        for (let assignedVar in assignment) {
            let [ax, ay] = assignment[assignedVar].split(',').map(Number);
            
            // C1: Tidak boleh tumpang tindih[cite: 4]
            if (vx === ax && vy === ay) return false;

            // C2: Jarak minimum musuh (Enemy vs Enemy) minimal 3 kotak
            if (variable.startsWith('E') && assignedVar.startsWith('E')) {
                let dist = Math.abs(vx - ax) + Math.abs(vy - ay);
                if (dist < 3) return false;
            }
        }
        return true;
    }

    // MRV (Minimum Remaining Values)[cite: 23]
    selectUnassignedVariable(variables, assignment, domains) {
        let unassigned = variables.filter(v => !(v in assignment));
        unassigned.sort((a, b) => domains[a].length - domains[b].length);
        return unassigned[0];
    }

    // LCV (Least Constraining Value)[cite: 29]
    orderDomainValues(variable, assignment, domains) {
        return domains[variable]; 
    }

    // AC-3 Inference (Forward Checking)[cite: 32, 38]
    inference(variable, value, domains, variables, assignment) {
        let pruned = {};
        for (let v of variables) {
            if (!(v in assignment) && v !== variable) {
                let initialLength = domains[v].length;
                domains[v] = domains[v].filter(val => this.isConsistent(v, val, { ...assignment, [variable]: value }));
                if (domains[v].length < initialLength) pruned[v] = true;
                if (domains[v].length === 0) return { success: false, pruned }; // Dead end[cite: 42]
            }
        }
        return { success: true, pruned };
    }

    // Backtracking Search[cite: 44]
    solveBacktracking(variables, domains, assignment = {}) {
        this.steps++;
        if (Object.keys(assignment).length === variables.length) return assignment;

        let v = this.selectUnassignedVariable(variables, assignment, domains);
        let orderedValues = this.orderDomainValues(v, assignment, domains);

        for (let val of orderedValues) {
            if (this.isConsistent(v, val, assignment)) {
                assignment[v] = val;
                
                let localDomains = JSON.parse(JSON.stringify(domains));
                let inferResult = this.inference(v, val, localDomains, variables, assignment);

                if (inferResult.success) {
                    let result = this.solveBacktracking(variables, localDomains, assignment);
                    if (result !== null) return result;
                }

                delete assignment[v];
                this.backtracks++;
            }
        }
        return null;
    }

    // Local Search (Min-Conflicts)[cite: 46]
    solveLocalSearch(variables, domains, maxSteps = 1000) {
        let current = {};
        variables.forEach(v => {
            current[v] = domains[v][Math.floor(Math.random() * domains[v].length)];
        });

        for (let i = 0; i < maxSteps; i++) {
            this.steps++;
            let conflicted = variables.filter(v => !this.isConsistent(v, current[v], current));
            if (conflicted.length === 0) return current;

            let varToFix = conflicted[Math.floor(Math.random() * conflicted.length)];
            let minConflicts = Infinity;
            let bestValue = current[varToFix];
            
            for (let val of domains[varToFix]) {
                let testAssignment = { ...current, [varToFix]: val };
                let conflicts = variables.filter(v => !this.isConsistent(v, testAssignment[v], testAssignment)).length;
                
                if (conflicts < minConflicts) {
                    minConflicts = conflicts;
                    bestValue = val;
                }
            }
            current[varToFix] = bestValue;
        }
        return null;
    }
}