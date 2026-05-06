import openpyxl
import json

def search_verticals(filename):
    try:
        wb = openpyxl.load_workbook(filename, data_only=True)
        sheet = wb.active
        found = []
        # Check first 100 rows
        for r_idx, row in enumerate(sheet.iter_rows(max_row=100, values_only=True), 1):
            for c_idx, val in enumerate(row, 1):
                if val and isinstance(val, str) and "Consultoría" in val:
                    found.append({"row": r_idx, "col": c_idx, "value": val})
        return found
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    result = search_verticals("Reportes de Vacaciones-2026-04-30.xlsx")
    print(json.dumps(result, indent=2))
