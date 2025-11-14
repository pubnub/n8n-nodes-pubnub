const { src, dest } = require('gulp');
const path = require('path');

function buildIcons() {
	// Copy all SVG files while preserving directory structure
	return src('nodes/**/*.svg', { base: '.' })
		.pipe(dest('.'));
}

function copyIconsToDist() {
	// Copy icons to dist directory
	return src('nodes/**/*.svg')
		.pipe(dest((file) => {
			// Preserve the directory structure in dist
			const relativePath = path.relative('nodes', path.dirname(file.path));
			return path.join('dist/nodes', relativePath);
		}));
}

exports['build:icons'] = copyIconsToDist;
exports.default = copyIconsToDist;
