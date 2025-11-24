const { src, dest } = require('gulp');
const path = require('path');

function buildIcons() {
    // Copy all SVG files while preserving directory structure
    return src('nodes/**/*.svg', { base: '.' })
        .pipe(dest('.'));
}

function copyIconsToDist() {
    // Copy node icons to dist directory
    const nodeIcons = src('nodes/**/*.svg')
        .pipe(dest((file) => {
            // Preserve the directory structure in dist
            const relativePath = path.relative('nodes', path.dirname(file.path));
            return path.join('dist/nodes', relativePath);
        }));

    // Copy credential icons to dist directory
    const credentialIcons = src('credentials/**/*.svg')
        .pipe(dest('dist/credentials'));

    // Return both tasks
    return Promise.all([nodeIcons, credentialIcons]);
}

exports['build:icons'] = copyIconsToDist;
exports.default = copyIconsToDist;
