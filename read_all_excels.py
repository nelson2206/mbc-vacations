import openpyxl
import json

def read_excel_data(filename):
    try:
        wb = openpyxl.load_workbook(filename, data_only=True)
        sheet = wb.active
        rows = []
        for row in sheet.iter_rows(values_only=True):
            rows.append(list(row))
        return rows
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    results = {}
    results["verticals"] = read_excel_data("Verticales.xlsx")
    results["real"] = read_excel_data("Gestion real.xlsx")
    print(json.dumps(results, indent=2, default=str))
