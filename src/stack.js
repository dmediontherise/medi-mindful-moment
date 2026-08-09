export let sessionStack = [];
export let stackIndex = -1;

export function pushToStack(aff) {
    if (stackIndex < sessionStack.length - 1) {
        sessionStack.splice(stackIndex + 1);
    }
    sessionStack.push(aff);
    stackIndex = sessionStack.length - 1;
    if (sessionStack.length > 10) {
        sessionStack.shift();
        stackIndex--;
    }
}

export function resetStack() {
    sessionStack = [];
    stackIndex = -1;
}

export function setStackIndex(index) {
    stackIndex = index;
}

export function getStackIndex() {
    return stackIndex;
}

export function getSessionStack() {
    return sessionStack;
}
