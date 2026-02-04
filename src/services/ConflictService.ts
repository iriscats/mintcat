/**
 * Mod Conflict Service
 * 
 * Manages conflict detection state for mods in memory.
 * Conflicts are determined by detecting files with the same path across multiple mods.
 */

import { emitEvent } from "@/events";

/**
 * Conflict information for a single mod
 */
export interface ConflictInfo {
    /** The mod ID that has conflicts */
    modId: number;
    /** List of mod IDs that conflict with this mod */
    conflictingMods: number[];
    /** List of file paths that are in conflict */
    conflictingFiles: string[];
}

/**
 * Backend response structure for conflict check
 */
export interface ModConflictResponse {
    mod_id: number;
    conflicting_mods: number[];
    conflicting_files: string[];
}

// Module-level state storage for conflict information
const conflictMap = new Map<number, ConflictInfo>();

/**
 * ConflictService - Static service for managing mod conflict state
 */
export class ConflictService {
    /**
     * Set conflicts from backend response
     * Converts snake_case response to camelCase and stores in memory
     */
    static setConflicts(conflicts: ModConflictResponse[]): void {
        // Clear existing conflicts
        conflictMap.clear();
        
        // Store new conflicts
        for (const conflict of conflicts) {
            const info: ConflictInfo = {
                modId: conflict.mod_id,
                conflictingMods: conflict.conflicting_mods,
                conflictingFiles: conflict.conflicting_files,
            };
            conflictMap.set(info.modId, info);
        }
        
        // Emit event to notify UI components about conflict updates
        // Emit for all mods that might need to update their display
        this.emitUpdateEvents();
    }
    
    /**
     * Get conflict information for a specific mod
     * @param modId The mod ID to check
     * @returns ConflictInfo if the mod has conflicts, null otherwise
     */
    static getConflict(modId: number): ConflictInfo | null {
        return conflictMap.get(modId) || null;
    }
    
    /**
     * Check if a mod has any conflicts
     * @param modId The mod ID to check
     * @returns true if the mod has conflicts with other mods
     */
    static hasConflict(modId: number): boolean {
        return conflictMap.has(modId);
    }
    
    /**
     * Get all mods that have conflicts
     * @returns Array of mod IDs that have conflicts
     */
    static getConflictingModIds(): number[] {
        return Array.from(conflictMap.keys());
    }
    
    /**
     * Get all conflict information
     * @returns Array of all ConflictInfo objects
     */
    static getAllConflicts(): ConflictInfo[] {
        return Array.from(conflictMap.values());
    }
    
    /**
     * Clear all conflict data
     */
    static clearAll(): void {
        const previousModIds = Array.from(conflictMap.keys());
        conflictMap.clear();
        
        // Emit update events for previously conflicting mods
        for (const modId of previousModIds) {
            emitEvent('mod-conflict-update', { modId, hasConflict: false });
        }
    }
    
    /**
     * Emit update events for all mods in the conflict map
     */
    private static emitUpdateEvents(): void {
        for (const [modId, _] of conflictMap) {
            emitEvent('mod-conflict-update', { modId, hasConflict: true });
        }
    }
    
    /**
     * Get a formatted string describing conflicts for a mod
     * @param modId The mod ID to get description for
     * @returns Human-readable conflict description or empty string
     */
    static getConflictDescription(modId: number): string {
        const conflict = this.getConflict(modId);
        if (!conflict) return '';
        
        const fileCount = conflict.conflictingFiles.length;
        const modCount = conflict.conflictingMods.length;
        
        return `${fileCount} file(s) conflict with ${modCount} other mod(s)`;
    }
}
