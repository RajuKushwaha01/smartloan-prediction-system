const PDFDocument = require('pdfkit');
const XLSX = require('xlsx');

function generateAdminReportPDF(res, data) {
  const doc = new PDFDocument({ margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=SmartLoanAI_Admin_Report.pdf');
  doc.pipe(res);

  doc.fontSize(20).fillColor('#2563EB').text('SMARTLOAN AI', { align: 'center' });
  doc.fontSize(12).fillColor('#64748B').text('ADMINISTRATIVE SYSTEM REPORT', { align: 'center' });
  doc.moveDown(1.5);
  doc.strokeColor('#E2E8F0').moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown();

  doc.fontSize(13).fillColor('#7C3AED').text('OVERVIEW');
  doc.fontSize(11).fillColor('#0F172A');
  doc.text(`Total Users: ${data.totalUsers}`);
  doc.text(`Total Applications: ${data.totalApplications}`);
  doc.text(`Total Predictions: ${data.totalPredictions}`);
  doc.moveDown();
  doc.strokeColor('#E2E8F0').moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown();

  doc.fontSize(13).fillColor('#7C3AED').text('PREDICTION DISTRIBUTION');
  doc.fontSize(11).fillColor('#0F172A');
  doc.text(`Eligible: ${data.eligible}`);
  doc.text(`Review: ${data.review}`);
  doc.text(`Not Eligible: ${data.notEligible}`);
  doc.moveDown();
  doc.strokeColor('#E2E8F0').moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown();

  doc.fontSize(13).fillColor('#7C3AED').text('MODEL METRICS');
  doc.fontSize(11).fillColor('#0F172A');
  if (data.modelMetrics) {
    doc.text(`Model: ${data.modelMetrics.selected_model} (${data.modelMetrics.model_version})`);
    const m = data.modelMetrics.selected_model_metrics;
    doc.text(`Accuracy: ${(m.accuracy * 100).toFixed(2)}%`);
    doc.text(`Precision: ${(m.precision * 100).toFixed(2)}%`);
    doc.text(`Recall: ${(m.recall * 100).toFixed(2)}%`);
    doc.text(`F1-Score: ${(m.f1_score * 100).toFixed(2)}%`);
    doc.text(`ROC-AUC: ${(m.roc_auc * 100).toFixed(2)}%`);
  } else {
    doc.text('Model metrics unavailable (ML service unreachable).');
  }
  doc.moveDown();
  doc.strokeColor('#E2E8F0').moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown();

  doc.fontSize(13).fillColor('#7C3AED').text('MONTHLY APPLICATION TREND');
  doc.fontSize(11).fillColor('#0F172A');
  data.monthlyTrend.forEach(row => {
    doc.text(`${row.month}: ${row.count} applications`);
  });
  doc.moveDown();

  doc.fontSize(9).fillColor('#64748B').text(`Generated: ${new Date().toDateString()}`, { align: 'center' });

  doc.end();
}

function generateAdminReportExcel(res, data) {
  const workbook = XLSX.utils.book_new();

  const overviewSheet = XLSX.utils.json_to_sheet([
    { Metric: 'Total Users', Value: data.totalUsers },
    { Metric: 'Total Applications', Value: data.totalApplications },
    { Metric: 'Total Predictions', Value: data.totalPredictions },
    { Metric: 'Eligible', Value: data.eligible },
    { Metric: 'Review', Value: data.review },
    { Metric: 'Not Eligible', Value: data.notEligible }
  ]);
  XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Overview');

  const trendSheet = XLSX.utils.json_to_sheet(data.monthlyTrend);
  XLSX.utils.book_append_sheet(workbook, trendSheet, 'Monthly Trend');

  if (data.modelMetrics) {
    const m = data.modelMetrics.selected_model_metrics;
    const modelSheet = XLSX.utils.json_to_sheet([{
      Model: data.modelMetrics.selected_model,
      Version: data.modelMetrics.model_version,
      Accuracy: `${(m.accuracy * 100).toFixed(2)}%`,
      Precision: `${(m.precision * 100).toFixed(2)}%`,
      Recall: `${(m.recall * 100).toFixed(2)}%`,
      F1Score: `${(m.f1_score * 100).toFixed(2)}%`,
      ROC_AUC: `${(m.roc_auc * 100).toFixed(2)}%`
    }]);
    XLSX.utils.book_append_sheet(workbook, modelSheet, 'Model Metrics');
  }

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=SmartLoanAI_Admin_Report.xlsx');
  res.send(buffer);
}

module.exports = { generateAdminReportPDF, generateAdminReportExcel };