// ============================================================
// SECUREDOCHAIN - DOCUMENT DIFFERENCE UTILITY
// ============================================================
//
// Supports:
//
// - Added lines
// - Removed lines
// - Modified lines
// - Unchanged lines are omitted from final result
//
// Uses LCS for normal-sized documents.
//
// Large documents automatically use an approximate comparison
// to prevent excessive memory/CPU consumption.
//
// ============================================================


const MAX_LINES = 5000;
const MAX_COMPARISON_CELLS = 2500000;


// ============================================================
// NORMALIZE LINE
// ============================================================
//
// This is especially useful for PDF extracted text because PDF
// extraction can contain inconsistent spaces.
//
// ============================================================

function normalizeLine(line) {
  if (
    line === null ||
    line === undefined
  ) {
    return '';
  }

  return String(line)
    .replace(/\u0000/g, '')
    .replace(/\t/g, ' ')
    .replace(/[ ]+/g, ' ')
    .trim();
}


// ============================================================
// NORMALIZE TEXT
// ============================================================

function normalizeText(text) {
  if (
    text === null ||
    text === undefined
  ) {
    return '';
  }

  return String(text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u0000/g, '');
}


// ============================================================
// GET LINES
// ============================================================

function getLines(text) {
  const normalized =
    normalizeText(text);

  return normalized
    .split('\n')
    .map(normalizeLine);
}


// ============================================================
// CHECK WHETHER TWO LINES ARE EQUIVALENT
// ============================================================
//
// We compare normalized versions so that:
//
// "Hello   World"
//
// and
//
// "Hello World"
//
// are treated as the same line.
//
// ============================================================

function linesEqual(a, b) {
  return normalizeLine(a) ===
         normalizeLine(b);
}


// ============================================================
// APPROXIMATE DIFF
// ============================================================
//
// Used when the document is too large for the LCS matrix.
//
// Instead of performing an expensive global comparison, lines
// at corresponding positions are compared.
//
// ============================================================

function buildApproximateDiff(
  linesA,
  linesB
) {

  const diffLines = [];

  const maxLength =
    Math.max(
      linesA.length,
      linesB.length
    );


  for (
    let i = 0;
    i < maxLength;
    i++
  ) {

    const a =
      linesA[i] !== undefined
        ? linesA[i]
        : '';

    const b =
      linesB[i] !== undefined
        ? linesB[i]
        : '';


    // --------------------------------------------------------
    // Identical
    // --------------------------------------------------------

    if (
      i < linesA.length &&
      i < linesB.length &&
      linesEqual(a, b)
    ) {
      continue;
    }


    // --------------------------------------------------------
    // Removed
    // --------------------------------------------------------

    if (
      i < linesA.length &&
      i >= linesB.length
    ) {

      diffLines.push({

        aLine:
          i + 1,

        bLine:
          null,

        line:
          i + 1,

        type:
          'removed',

        versionA:
          a,

        versionB:
          ''
      });

      continue;
    }


    // --------------------------------------------------------
    // Added
    // --------------------------------------------------------

    if (
      i >= linesA.length &&
      i < linesB.length
    ) {

      diffLines.push({

        aLine:
          null,

        bLine:
          i + 1,

        line:
          i + 1,

        type:
          'added',

        versionA:
          '',

        versionB:
          b
      });

      continue;
    }


    // --------------------------------------------------------
    // Modified
    // --------------------------------------------------------

    diffLines.push({

      aLine:
        i + 1,

      bLine:
        i + 1,

      line:
        i + 1,

      type:
        'modified',

      versionA:
        a,

      versionB:
        b
    });
  }


  return {

    approximate:
      true,

    message:
      'Approximate comparison used because the document is large.',

    diffLines
  };
}



// ============================================================
// LCS DIFF
// ============================================================

function buildLineDiff(
  textA,
  textB
) {

  const linesA =
    getLines(textA);

  const linesB =
    getLines(textB);


  // ----------------------------------------------------------
  // Empty documents
  // ----------------------------------------------------------

  if (
    linesA.length === 1 &&
    linesA[0] === ''
  ) {
    linesA.length = 0;
  }

  if (
    linesB.length === 1 &&
    linesB[0] === ''
  ) {
    linesB.length = 0;
  }


  // ----------------------------------------------------------
  // Same content
  // ----------------------------------------------------------

  if (
    linesA.length === linesB.length
  ) {

    let identical = true;

    for (
      let i = 0;
      i < linesA.length;
      i++
    ) {

      if (
        !linesEqual(
          linesA[i],
          linesB[i]
        )
      ) {

        identical = false;
        break;
      }
    }


    if (identical) {

      return {

        approximate:
          false,

        message:
          'No changes detected.',

        diffLines:
          []
      };
    }
  }


  // ----------------------------------------------------------
  // Large-document protection
  // ----------------------------------------------------------

  const comparisonCells =
    linesA.length *
    linesB.length;


  if (
    linesA.length > MAX_LINES ||
    linesB.length > MAX_LINES ||
    comparisonCells > MAX_COMPARISON_CELLS
  ) {

    return buildApproximateDiff(
      linesA,
      linesB
    );
  }


  // ----------------------------------------------------------
  // LCS MATRIX
  // ----------------------------------------------------------

  const rows =
    linesA.length + 1;

  const cols =
    linesB.length + 1;


  const matrix =
    Array.from(
      {
        length:
          rows
      },
      () =>
        new Uint32Array(cols)
    );


  // ----------------------------------------------------------
  // Build LCS table
  // ----------------------------------------------------------

  for (
    let i = 1;
    i < rows;
    i++
  ) {

    for (
      let j = 1;
      j < cols;
      j++
    ) {

      if (
        linesEqual(
          linesA[i - 1],
          linesB[j - 1]
        )
      ) {

        matrix[i][j] =
          matrix[i - 1][j - 1] + 1;

      } else {

        matrix[i][j] =
          Math.max(
            matrix[i - 1][j],
            matrix[i][j - 1]
          );
      }
    }
  }


  // ----------------------------------------------------------
  // BACKTRACK
  // ----------------------------------------------------------

  const rawDiff = [];

  let i =
    linesA.length;

  let j =
    linesB.length;


  while (
    i > 0 ||
    j > 0
  ) {

    // --------------------------------------------------------
    // Matching line
    // --------------------------------------------------------

    if (
      i > 0 &&
      j > 0 &&
      linesEqual(
        linesA[i - 1],
        linesB[j - 1]
      )
    ) {

      i--;
      j--;

      continue;
    }


    // --------------------------------------------------------
    // Removal
    // --------------------------------------------------------

    if (
      i > 0 &&
      (
        j === 0 ||
        matrix[i - 1][j] >=
        matrix[i][j - 1]
      )
    ) {

      rawDiff.push({

        aLine:
          i,

        bLine:
          null,

        type:
          'removed',

        versionA:
          linesA[i - 1],

        versionB:
          ''
      });

      i--;

      continue;
    }


    // --------------------------------------------------------
    // Addition
    // --------------------------------------------------------

    if (
      j > 0
    ) {

      rawDiff.push({

        aLine:
          null,

        bLine:
          j,

        type:
          'added',

        versionA:
          '',

        versionB:
          linesB[j - 1]
      });

      j--;

      continue;
    }
  }


  // ----------------------------------------------------------
  // Reverse because backtracking creates the result backwards.
  // ----------------------------------------------------------

  rawDiff.reverse();


  // ==========================================================
  // GROUP REMOVAL + ADDITION AS MODIFICATION
  // ==========================================================
  //
  // Example:
  //
  // OLD:
  // Hello World
  //
  // NEW:
  // Hello Secure World
  //
  // Instead of:
  //
  // REMOVED
  // ADDED
  //
  // show:
  //
  // MODIFIED
  //
  // ==========================================================

  const diffLines = [];

  let index = 0;


  while (
    index < rawDiff.length
  ) {

    const current =
      rawDiff[index];


    // --------------------------------------------------------
    // Removal followed by addition
    // --------------------------------------------------------

    if (
      current.type === 'removed' &&
      index + 1 < rawDiff.length &&
      rawDiff[index + 1].type === 'added'
    ) {

      const next =
        rawDiff[index + 1];


      diffLines.push({

        aLine:
          current.aLine,

        bLine:
          next.bLine,

        line:
          next.bLine,

        type:
          'modified',

        versionA:
          current.versionA,

        versionB:
          next.versionB
      });


      index += 2;

      continue;
    }


    // --------------------------------------------------------
    // Addition followed by removal
    // --------------------------------------------------------

    if (
      current.type === 'added' &&
      index + 1 < rawDiff.length &&
      rawDiff[index + 1].type === 'removed'
    ) {

      const next =
        rawDiff[index + 1];


      diffLines.push({

        aLine:
          next.aLine,

        bLine:
          current.bLine,

        line:
          current.bLine,

        type:
          'modified',

        versionA:
          next.versionA,

        versionB:
          current.versionB
      });


      index += 2;

      continue;
    }


    // --------------------------------------------------------
    // Normal addition/removal
    // --------------------------------------------------------

    diffLines.push({

      ...current,

      line:
        current.bLine ||
        current.aLine
    });


    index++;
  }


  // ==========================================================
  // RETURN
  // ==========================================================

  return {

    approximate:
      false,

    message:
      diffLines.length === 0
        ? 'No changes detected.'
        : `${diffLines.length} changes detected.`,

    diffLines
  };
}



// ============================================================
// EXPORT
// ============================================================

module.exports = {
  buildLineDiff
};