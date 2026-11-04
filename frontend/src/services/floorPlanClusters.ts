export interface ClusterPoint {
    id: number;
    // Screen position in px, after pan and zoom.
    x: number;
    y: number;
    // Lower is more urgent; the most urgent marker leads its group.
    rank: number;
}

/**
 * Groups markers that would overlap on screen. Each group grows around its most
 * urgent marker, so a thirsty plant is never hidden behind a fine one, and groups
 * stay put while the other markers come and go with the page filters.
 */
export const clusterPoints = (points: ClusterPoint[], radius: number): number[][] => {
    const order = [...points].sort((a, b) => a.rank - b.rank || a.id - b.id);
    const used = new Set<number>();
    const groups: number[][] = [];
    for (const leader of order) {
        if (used.has(leader.id)) continue;
        used.add(leader.id);
        const group = [leader.id];
        for (const other of order) {
            if (!used.has(other.id) && Math.hypot(leader.x - other.x, leader.y - other.y) < radius) {
                used.add(other.id);
                group.push(other.id);
            }
        }
        groups.push(group);
    }
    return groups;
};
