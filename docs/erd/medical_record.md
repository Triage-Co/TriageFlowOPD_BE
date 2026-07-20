erDiagram
    PATIENT ||--o{ VISIT_SESSION : "có nhiều phiên khám (1:N)"
    VISIT_SESSION ||--o{ CLINICAL_DOCUMENT : "có nhiều tài liệu/kết quả (1:N)"

    PATIENT { 
        UUID id PK (đã có)
        (ngoài ra còn các attribute trước đó)
        String blood_type "Từ Medical Record cũ" (nullable)
        String allergy_notes "Từ Medical Record cũ" (nullable)
    }

    VISIT_SESSION {
        UUID id PK
        UUID patient_id FK
        DateTime visit_date
        String chief_complaint (nullable)
        Int heart_rate "Nhịp tim" (nullable)
        Int blood_pressure_sys "HA tâm thu" (nullable)
        Int blood_pressure_dia "HA tâm trương" (nullable)
        Numeric temperature "Nhiệt độ" (nullable)
        Int spo2 "SpO2" (nullable)
        String final_diagnosis (nullable)
    }

    CLINICAL_DOCUMENT {
        UUID id PK
        UUID visit_session_id FK
        String document_type "Enum: PRESCRIPTION, LAB_TEST..."
        JSONB payload_data "Lưu JSON chi tiết"
        String his_reference_id "ID tham chiếu từ HIS (nếu có)"
    }