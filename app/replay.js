import { applyAction, emptyWorkspaceLike } from "./merge.js";
function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}
export async function replayWorkspace(workspace, onFrame, onStatus) {
    const frames = workspace.actions.filter((action) => action.type !== "merge");
    const ghost = emptyWorkspaceLike(workspace);
    onStatus("Replaying workspace timeline…");
    onFrame(ghost);
    let current = ghost;
    for (const action of frames) {
        current = applyAction(current, action);
        onFrame(current);
        await sleep(320);
    }
    onStatus("Replay complete.");
}
