export interface MenuTreeNode {
    id: number;
    pid?: number;
    menus?: MenuTreeNode[];
    [key: string]: any;
}

export interface ParsedMenuItem {
    id: number;
    pid: number;
}

export function parseJsonArray(
    jsonArray: MenuTreeNode[],
    pid: number = 0,
): ParsedMenuItem[] {
    let result: ParsedMenuItem[] = [];
    if (!Array.isArray(jsonArray)) {
        return result;
    }

    for (const item of jsonArray) {
        result.push({ id: Number(item.id), pid });
        if (item.menus && Array.isArray(item.menus) && item.menus.length > 0) {
            const childResults = parseJsonArray(item.menus, Number(item.id));
            result = result.concat(childResults);
        }
    }

    return result;
}
