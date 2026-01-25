import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Validates the integrity of the category tree structure
 * Checks for:
 * - Circular references
 * - Orphaned categories
 * - Incorrect path values
 * - Incorrect level values
 */
async function validateCategoryTree(): Promise<ValidationResult> {
    const result: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: []
    };

    try {
        const categories = await prisma.category.findMany({
            include: {
                parent: true,
                children: true
            }
        });

        console.log(`\n📊 Validating ${categories.length} categories...\n`);

        // Check 1: Circular references
        for (const category of categories) {
            if (category.parentId) {
                const visited = new Set<number>();
                let current = category;

                while (current.parentId) {
                    if (visited.has(current.id)) {
                        result.isValid = false;
                        result.errors.push(
                            `❌ Circular reference detected: Category "${category.name}" (ID: ${category.id})`
                        );
                        break;
                    }

                    visited.add(current.id);
                    const parent = categories.find(c => c.id === current.parentId);
                    if (!parent) break;
                    current = parent;
                }
            }
        }

        // Check 2: Orphaned categories (parentId points to non-existent category)
        for (const category of categories) {
            if (category.parentId) {
                const parentExists = categories.some(c => c.id === category.parentId);
                if (!parentExists) {
                    result.isValid = false;
                    result.errors.push(
                        `❌ Orphaned category: "${category.name}" (ID: ${category.id}) has parentId ${category.parentId} which doesn't exist`
                    );
                }
            }
        }

        // Check 3: Validate level values
        for (const category of categories) {
            const expectedLevel = calculateLevel(category, categories);
            if (category.level !== expectedLevel) {
                result.warnings.push(
                    `⚠️  Incorrect level: "${category.name}" (ID: ${category.id}) has level ${category.level}, expected ${expectedLevel}`
                );
            }
        }

        // Check 4: Validate path values
        for (const category of categories) {
            const expectedPath = calculatePath(category, categories);
            if (category.path !== expectedPath) {
                result.warnings.push(
                    `⚠️  Incorrect path: "${category.name}" (ID: ${category.id}) has path "${category.path}", expected "${expectedPath}"`
                );
            }
        }

        // Summary
        console.log('='.repeat(60));
        if (result.errors.length === 0 && result.warnings.length === 0) {
            console.log('✅ Category tree is valid!');
        } else {
            if (result.errors.length > 0) {
                console.log(`\n❌ Found ${result.errors.length} error(s):`);
                result.errors.forEach(err => console.log(err));
            }
            if (result.warnings.length > 0) {
                console.log(`\n⚠️  Found ${result.warnings.length} warning(s):`);
                result.warnings.forEach(warn => console.log(warn));
            }
        }
        console.log('='.repeat(60));

    } catch (error) {
        result.isValid = false;
        result.errors.push(`Fatal error during validation: ${error}`);
        console.error('❌ Validation failed:', error);
    } finally {
        await prisma.$disconnect();
    }

    return result;
}

function calculateLevel(category: any, allCategories: any[]): number {
    if (!category.parentId) return 0;

    let level = 0;
    let current = category;

    while (current.parentId) {
        level++;
        current = allCategories.find(c => c.id === current.parentId);
        if (!current) break;
    }

    return level;
}

function calculatePath(category: any, allCategories: any[]): string {
    const pathParts: string[] = [];
    let current = category;

    while (current) {
        pathParts.unshift(current.name);
        if (!current.parentId) break;
        current = allCategories.find(c => c.id === current.parentId);
    }

    return pathParts.join('/');
}

// Run validation
validateCategoryTree()
    .then(result => {
        process.exit(result.isValid ? 0 : 1);
    })
    .catch(error => {
        console.error('Validation script failed:', error);
        process.exit(1);
    });
