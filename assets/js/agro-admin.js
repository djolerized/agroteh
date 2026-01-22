(function ($) {
    'use strict';

    // Check if we're on an admin page with the entities table
    const $table = $('#agro-entities-table, #agro-operations-table');
    if (!$table.length) {
        return;
    }

    const { ajaxUrl, nonce } = window.agroAdminData || {};

    // Entity type mapping for messages and actions
    const entityConfig = {
        fuel: {
            singular: 'gorivo',
            plural: 'goriva',
            genitive: 'goriva',
            action: 'agro_ajax_delete_fuel',
            bulkAction: 'agro_ajax_bulk_delete_fuels',
            idParam: 'fuel_id',
            bulkIdParam: 'fuel_ids'
        },
        tractor: {
            singular: 'traktor',
            plural: 'traktora',
            genitive: 'traktora',
            action: 'agro_ajax_delete_tractor',
            bulkAction: 'agro_ajax_bulk_delete_tractors',
            idParam: 'tractor_id',
            bulkIdParam: 'tractor_ids'
        },
        operation: {
            singular: 'operaciju',
            plural: 'operacija',
            genitive: 'operacije',
            action: 'agro_ajax_delete_operation',
            bulkAction: 'agro_ajax_bulk_delete_operations',
            idParam: 'operation_id',
            bulkIdParam: 'operation_ids'
        },
        crop: {
            singular: 'kulturu',
            plural: 'kultura',
            genitive: 'kulture',
            action: 'agro_ajax_delete_crop',
            bulkAction: 'agro_ajax_bulk_delete_crops',
            idParam: 'crop_id',
            bulkIdParam: 'crop_ids'
        }
    };

    // Show toast notification
    function showToast(message, type = 'success') {
        const toast = $('<div>')
            .addClass('notice notice-' + type + ' is-dismissible')
            .html('<p>' + message + '</p>')
            .hide();

        $('.wrap h1').after(toast);
        toast.slideDown();

        setTimeout(() => {
            toast.slideUp(() => toast.remove());
        }, 3000);
    }

    // Update selected count and bulk delete button visibility
    function updateBulkDeleteButton() {
        const selectedCount = $('.agro-entity-checkbox, .agro-operation-checkbox').filter(':checked').length;
        $('#agro-selected-count').text(selectedCount);

        if (selectedCount > 0) {
            $('#agro-bulk-delete-btn').fadeIn();
        } else {
            $('#agro-bulk-delete-btn').fadeOut();
        }
    }

    // Handle select all checkbox
    $('#agro-select-all, #agro-select-all-operations').on('change', function () {
        const isChecked = $(this).prop('checked');
        $('.agro-entity-checkbox, .agro-operation-checkbox').prop('checked', isChecked);
        updateBulkDeleteButton();
    });

    // Handle individual checkbox change
    $(document).on('change', '.agro-entity-checkbox, .agro-operation-checkbox', function () {
        const totalCheckboxes = $('.agro-entity-checkbox, .agro-operation-checkbox').length;
        const checkedCheckboxes = $('.agro-entity-checkbox, .agro-operation-checkbox').filter(':checked').length;

        $('#agro-select-all, #agro-select-all-operations').prop('checked', totalCheckboxes === checkedCheckboxes);
        updateBulkDeleteButton();
    });

    // Handle single delete
    $(document).on('click', '.agro-delete-entity, .agro-delete-operation', function (e) {
        e.preventDefault();

        const $link = $(this);
        const entityId = $link.data('entity-id') || $link.data('operation-id');
        const entityName = $link.data('entity-name') || $link.data('operation-name');
        const entityType = $link.data('entity-type') || 'operation';
        const config = entityConfig[entityType];

        if (!config) {
            console.error('Unknown entity type:', entityType);
            return;
        }

        if (!confirm('Da li ste sigurni da želite da obrišete ' + config.singular + ' "' + entityName + '"?')) {
            return;
        }

        const $row = $link.closest('tr');
        $row.css('opacity', '0.5');
        $link.text('Brisanje...');

        const ajaxData = {
            action: config.action,
            nonce: nonce
        };
        ajaxData[config.idParam] = entityId;

        $.ajax({
            url: ajaxUrl,
            type: 'POST',
            data: ajaxData,
            success: function (response) {
                if (response.success) {
                    $row.fadeOut(300, function () {
                        $(this).remove();
                        updateBulkDeleteButton();

                        // If no rows left, reload the page to show empty state
                        if ($table.find('tbody tr').length === 0) {
                            location.reload();
                        }
                    });
                    showToast(response.data.message, 'success');
                } else {
                    $row.css('opacity', '1');
                    $link.text('Obriši');
                    showToast(response.data.message || 'Greška pri brisanju.', 'error');
                }
            },
            error: function () {
                $row.css('opacity', '1');
                $link.text('Obriši');
                showToast('Greška pri komunikaciji sa serverom.', 'error');
            }
        });
    });

    // Handle bulk delete
    $('#agro-bulk-delete-btn').on('click', function () {
        const selectedCount = $('.agro-entity-checkbox, .agro-operation-checkbox').filter(':checked').length;

        if (selectedCount === 0) {
            return;
        }

        const entityType = $(this).data('entity') || 'operation';
        const config = entityConfig[entityType];

        if (!config) {
            console.error('Unknown entity type:', entityType);
            return;
        }

        if (!confirm('Da li ste sigurni da želite da obrišete ' + selectedCount + ' ' + config.plural + '?')) {
            return;
        }

        const entityIds = [];
        const $selectedRows = [];

        $('.agro-entity-checkbox, .agro-operation-checkbox').filter(':checked').each(function () {
            entityIds.push($(this).val());
            $selectedRows.push($(this).closest('tr'));
        });

        // Visual feedback
        $selectedRows.forEach($row => $row.css('opacity', '0.5'));
        $(this).prop('disabled', true).text('Brisanje...');

        const ajaxData = {
            action: config.bulkAction,
            nonce: nonce
        };
        ajaxData[config.bulkIdParam] = entityIds;

        $.ajax({
            url: ajaxUrl,
            type: 'POST',
            data: ajaxData,
            success: function (response) {
                if (response.success) {
                    $selectedRows.forEach($row => {
                        $row.fadeOut(300, function () {
                            $(this).remove();

                            // If no rows left, reload the page
                            if ($table.find('tbody tr').length === 0) {
                                location.reload();
                            }
                        });
                    });

                    $('#agro-bulk-delete-btn').prop('disabled', false).text('Obriši odabrane (0)').hide();
                    $('#agro-select-all, #agro-select-all-operations').prop('checked', false);
                    showToast(response.data.message, 'success');
                } else {
                    $selectedRows.forEach($row => $row.css('opacity', '1'));
                    $('#agro-bulk-delete-btn').prop('disabled', false).text('Obriši odabrane (' + selectedCount + ')');
                    showToast(response.data.message || 'Greška pri brisanju.', 'error');
                }
            },
            error: function () {
                $selectedRows.forEach($row => $row.css('opacity', '1'));
                $('#agro-bulk-delete-btn').prop('disabled', false).text('Obriši odabrane (' + selectedCount + ')');
                showToast('Greška pri komunikaciji sa serverom.', 'error');
            }
        });
    });

})(jQuery);
