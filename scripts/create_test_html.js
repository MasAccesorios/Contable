const fs = require('fs');

const generateHtml = () => {
    let rowsHtml = '';
    for (let i = 1; i <= 35; i++) {
        rowsHtml += `
            <tr style="border-bottom: 1px solid #dee2e6; font-size: 12px; color: #495057; page-break-inside: avoid;">
                <td style="padding: 8px 4px;">REF-${i}</td>
                <td style="padding: 8px 4px;">
                    <div style="font-weight: 600; color: #212529;">Producto de prueba ${i}</div>
                    <div style="font-size: 10.5px; color: #6c757d; margin-top: 3px;">Descripción larga para forzar altura en el producto de prueba ${i}.</div>
                </td>
                <td style="padding: 8px 4px; text-align: right;">$ 10.000,00</td>
                <td style="padding: 8px 4px; text-align: center;">1</td>
                <td style="padding: 8px 4px; text-align: right;">0%</td>
                <td style="padding: 8px 4px; text-align: right;">$ 10.000,00</td>
            </tr>
        `;
    }

    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Impresión Prueba</title>
        <link rel="stylesheet" href="css/styles.css">
    </head>
    <body style="background-color: white;">
        <div id="app-container"></div>
        <div id="print-view-container" class="print-document-template hoja-dinamica">
            <!-- HEADER IMPRESIÓN -->
            <div style="display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #6c757d; padding-bottom: 15px; margin-bottom: 25px;">
                <div style="width: 40%;">
                    <img src="LogoMas.png" style="max-height: 80px; margin-bottom: 5px;" alt="Logo" onerror="this.style.display='none'">
                </div>
                <div style="text-align: right; width: 40%; padding-top: 15px;">
                    <p style="margin: 0; font-size: 14px; color: #6c757d; font-weight: bold;">3158512091</p>
                </div>
            </div>

            <h2 style="color: #495057; margin-top: 0; margin-bottom: 20px;">Cotización</h2>

            <!-- INFO CLIENTE Y DOC -->
            <div style="display: flex; justify-content: space-between; margin-bottom: 25px;">
                <div style="background-color: #f8f9fa; padding: 20px; width: 48%; border-radius: 6px;">
                    <p style="margin: 0 0 10px 0; font-weight: bold; font-size: 16px; color: #212529;">Cliente de Prueba</p>
                    <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 5px;">
                        <strong style="color: #495057;">CC/NIT</strong><span>123456789</span>
                    </div>
                </div>
                <div style="width: 45%;">
                    <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 15px; padding-bottom: 5px; border-bottom: 1px solid #dee2e6;">
                        <strong style="color: #495057;">Cotización No.</strong><span style="font-weight: bold; font-size: 15px;">9999</span>
                    </div>
                </div>
            </div>

            <!-- TABLA DE PRODUCTOS -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 35px;">
                <thead style="display: table-header-group;">
                    <tr style="border-bottom: 2px solid #dee2e6; color: #495057; font-size: 13px;">
                        <th style="text-align: left; padding: 8px 4px;">Referencia</th>
                        <th style="text-align: left; padding: 8px 4px;">Ítem</th>
                        <th style="text-align: right; padding: 8px 4px;">Precio</th>
                        <th style="text-align: center; padding: 8px 4px;">Cantidad</th>
                        <th style="text-align: right; padding: 8px 4px;">Descuento</th>
                        <th style="text-align: right; padding: 8px 4px;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <!-- FOOTER TOTALES -->
            <div style="page-break-inside: avoid;">
                <div style="display: flex; justify-content: space-between; margin-top: 24px;">
                    <div style="width: 50%;">
                        <h5 style="color: #6c757d; font-size: 14px; margin: 0 0 8px 0;">Observaciones</h5>
                        <p style="font-size: 12px; color: #495057; margin: 0;">Nota de prueba larga.</p>
                    </div>
                    <div style="width: 38%;">
                        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px;">
                            <strong style="color: #495057;">Subtotal</strong><span>$ 350.000,00</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 16px; margin-bottom: 12px; border-top: 1px solid #dee2e6; padding-top: 8px;">
                            <strong style="color: #212529;">Total</strong><span style="font-weight: bold; color: #212529;">$ 350.000,00</span>
                        </div>
                        <div style="text-align: right; font-size: 12px; font-weight: bold; color: #6c757d;">
                            Cantidad de productos: 35
                        </div>
                    </div>
                </div>

                <!-- FIRMA -->
                <div style="text-align: center; margin-top: 40px; margin-bottom: 20px;">
                    <div style="width: 200px; height: 50px; background-color: #f8f9fa; margin: 0 auto; border-bottom: 1px solid #495057;"></div>
                    <p style="font-size: 10px; color: #212529; margin-top: 5px;">ELABORADO POR</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;

    fs.writeFileSync('test_print.html', html);
    console.log('HTML test file created.');
};
generateHtml();
