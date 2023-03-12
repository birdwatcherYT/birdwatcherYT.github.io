const COLORS = ["blue", "red", "green", "gold", "cyan", "magenta", "black"];
function makeTable(data, firstIsX) {
	let str = '<table class="output">';
	for (let j = 0; j < data[0].length; ++j) {
		const flag = (firstIsX && j == 0);
		const intercept = firstIsX ? -1 : 0;
		str += `<th bgcolor="${flag ? "white" : COLORS[(intercept + j) % COLORS.length]}"> </th>`
	}
	for (let i = 0; i < data.length; ++i) {
		str += "<tr>";
		for (let j = 0; j < data[i].length; ++j) {
			const flag = firstIsX && j == 0;
			str += `<td>${flag ? '<b>' : ''}${data[i][j]}${flag ? '</b>' : ''}</td>`
		}
		str += "</tr>";
	}
	str += "</table>";
	return str;
}
function getShape(data) {
	let maxrow = data.length, maxcol = 0;
	for (const row of data)
		maxcol = Math.max(maxcol, row.length);
	return [maxrow, maxcol];
}
function getMaxX(data) {
	let maxval = 0;
	for (const row of data)
		for (const val of row)
			maxval = Math.max(maxval, val);
	return maxval;
}
function getMinMax(data) {
	let minval = null, maxval = null;
	for (const row of data) {
		if (typeof (row) == "number") {
			minval = minval == null ? row : Math.min(minval, row);
			maxval = maxval == null ? row : Math.max(maxval, row);
			continue;
		}
		for (const val of row) {
			minval = minval == null ? val : Math.min(minval, val);
			maxval = maxval == null ? val : Math.max(maxval, val);
		}
	}
	return [minval, maxval];
}
// i列目を返す
function arange(size) {
	return [...new Array(size)].map((_, i) => i);
}
// i列目を返す
function getCol(data, i) {
	return data.map(row => row[i]);
}
// 最初の列を無視した結果を返す
function getIgnoreFirstCol(data) {
	return data.map(row => row.slice(1));
}
// いい感じの見た目の数字を返す
function numberToString(num, precision) {
	const str = num.toPrecision(precision);
	const [base, exp] = str.split("e");
	console.log(base, exp);
	return exp == undefined ? `${Number(base)}` : `${Number(base)}e${Number(exp)}`;
}
function plotGraph(xConverter, yConverter, x, y, color = "black", markerSize = 1, lineWidth = 1) {
	let str = "";
	// 折れ線
	if (lineWidth)
		str += `<polyline points="${y.map((yi, i) => xConverter(x[i]) + ',' + yConverter(y[i])).join(' ')}" stroke="${color}" stroke-width="${lineWidth}" fill="transparent"/>`;
	// マーカー
	if (markerSize)
		str += y.map((yi, i) => `<circle cx="${xConverter(x[i])}" cy="${yConverter(yi)}" r="${markerSize}" fill="${color}"/>`).join("");
	return str;
}
function makeSVG(dataOrg, firstIsX, property) {
	const xData = firstIsX ? getCol(dataOrg, 0) : arange(dataOrg.length);
	const yData = firstIsX ? getIgnoreFirstCol(dataOrg) : dataOrg;

	const [maxRow, maxCol] = getShape(yData);
	const [xMinVal, xMaxVal] = getMinMax(xData);
	const [yMinVal, yMaxVal] = getMinMax(yData);
	const svgTagWidth = property.width;
	const svgTagHeight = property.height;
	const margin = property.margin;
	const fontSize = property.fontSize;
	const markerSize = property.markerSize;
	const lineWidth = property.lineWidth;
	const gridNum = property.gridNum;
	const precision = property.precision;
	const widthScale = svgTagWidth / (xMaxVal - xMinVal + 1);
	const heightScale = svgTagHeight / (yMaxVal - yMinVal + 1);
	const width = (xMaxVal - xMinVal) * widthScale + 2 * margin;
	const height = (yMaxVal - yMinVal) * heightScale + 2 * margin;

	let svgStr = `<svg viewBox="0 0 ${width} ${height}" width="${svgTagWidth}" height="${svgTagHeight}" xmlns="http://www.w3.org/2000/svg">`;
	const yConverter = (val) => { return (height - margin) - (val - yMinVal) * heightScale; };
	const xConverter = (val) => { return (val - xMinVal) * widthScale + margin; };
	// x軸
	svgStr += `<line x1="${0}" x2="${width}" y1="${yConverter(yMinVal)}" y2="${yConverter(yMinVal)}" stroke="gray" stroke-width="1"/>`
	// y軸
	svgStr += `<line x1="${xConverter(0)}" x2="${xConverter(0)}" y1="${0}" y2="${height}" stroke="gray" stroke-width="1"/>`
	// 目盛り
	for (let i = 0; i <= gridNum; ++i) {
		const x = xMinVal + (xMaxVal - xMinVal) * i / gridNum;
		const y = yMinVal + (yMaxVal - yMinVal) * i / gridNum;
		// 破線
		svgStr += `<line x1="${0}" y1="${yConverter(y)}" x2="${width}" y2="${yConverter(y)}" stroke="gray" stroke-width="1" stroke-dasharray="5" stroke-opacity="0.5"/>`;
		svgStr += `<line x1="${xConverter(x)}" y1="${0}" x2="${xConverter(x)}" y2="${height}" stroke="gray" stroke-width="1" stroke-dasharray="5" stroke-opacity="0.5"/>`;
		// 数値
		svgStr += `<text x="${xConverter(x)}" y="${yConverter(yMinVal) + fontSize * 1.5}" font-size="${fontSize}" text-anchor="middle">${numberToString(x, precision)}</text>`;
		svgStr += `<text x="${xConverter(0) - fontSize * 0.5}" y="${yConverter(y)}" font-size="${fontSize}" text-anchor="end">${numberToString(y, precision)}</text>`;
	}

	for (let i = 0; i < maxCol; ++i) {
		const y = getCol(yData, i);
		svgStr += plotGraph(xConverter, yConverter, xData, y, COLORS[i % COLORS.length], markerSize, lineWidth);
	}

	svgStr += "</svg>";
	return svgStr;
}
