def test_services_do_not_import_api_schemas() -> None:
    from pathlib import Path

    service_files = Path('app/services').glob('*.py')
    assert all('app.schemas' not in path.read_text(encoding='utf-8') for path in service_files)
