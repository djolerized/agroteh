(function ($) {
    'use strict';

    // Check if we're on the operations page
    if (!document.getElementById('agro-operations-table')) {
        return;
    }

    const { ajaxUrl, nonce } = window.agroAdminData || {};

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
        const selectedCount = $('.agro-operation-checkbox:checked').length;
        $('#agro-selected-count').text(selectedCount);

        if (selectedCount > 0) {
            $('#agro-bulk-delete-btn').fadeIn();
        } else {
            $('#agro-bulk-delete-btn').fadeOut();
        }
    }

    // Handle select all checkbox
    $('#agro-select-all-operations').on('change', function () {
        const isChecked = $(this).prop('checked');
        $('.agro-operation-checkbox').prop('checked', isChecked);
        updateBulkDeleteButton();
    });

    // Handle individual checkbox change
    $(document).on('change', '.agro-operation-checkbox', function () {
        const totalCheckboxes = $('.agro-operation-checkbox').length;
        const checkedCheckboxes = $('.agro-operation-checkbox:checked').length;

        $('#agro-select-all-operations').prop('checked', totalCheckboxes === checkedCheckboxes);
        updateBulkDeleteButton();
    });

    // Handle single delete
    $(document).on('click', '.agro-delete-operation', function (e) {
        e.preventDefault();

        const $link = $(this);
        const operationId = $link.data('operation-id');
        const operationName = $link.data('operation-name');

        if (!confirm('Da li ste sigurni da želite da obrišete operaciju "' + operationName + '"?')) {
            return;
        }

        const $row = $link.closest('tr');
        $row.css('opacity', '0.5');
        $link.text('Brisanje...');

        $.ajax({
            url: ajaxUrl,
            type: 'POST',
            data: {
                action: 'agro_ajax_delete_operation',
                nonce: nonce,
                operation_id: operationId
            },
            success: function (response) {
                if (response.success) {
                    $row.fadeOut(300, function () {
                        $(this).remove();
                        updateBulkDeleteButton();

                        // If no rows left, reload the page to show empty state
                        if ($('#agro-operations-table tbody tr').length === 0) {
                            location.reload();
                        }
                    });
                    showToast(response.data.message, 'success');
                } else {
                    $row.css('opacity', '1');
                    $link.text('Obriši');
                    showToast(response.data.message || 'Greška pri brisanju operacije.', 'error');
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
        const selectedCount = $('.agro-operation-checkbox:checked').length;

        if (selectedCount === 0) {
            return;
        }

        if (!confirm('Da li ste sigurni da želite da obrišete ' + selectedCount + ' operacija?')) {
            return;
        }

        const operationIds = [];
        const $selectedRows = [];

        $('.agro-operation-checkbox:checked').each(function () {
            operationIds.push($(this).val());
            $selectedRows.push($(this).closest('tr'));
        });

        // Visual feedback
        $selectedRows.forEach($row => $row.css('opacity', '0.5'));
        $(this).prop('disabled', true).text('Brisanje...');

        $.ajax({
            url: ajaxUrl,
            type: 'POST',
            data: {
                action: 'agro_ajax_bulk_delete_operations',
                nonce: nonce,
                operation_ids: operationIds
            },
            success: function (response) {
                if (response.success) {
                    $selectedRows.forEach($row => {
                        $row.fadeOut(300, function () {
                            $(this).remove();

                            // If no rows left, reload the page
                            if ($('#agro-operations-table tbody tr').length === 0) {
                                location.reload();
                            }
                        });
                    });

                    $('#agro-bulk-delete-btn').prop('disabled', false).text('Obriši odabrane (0)').hide();
                    $('#agro-select-all-operations').prop('checked', false);
                    showToast(response.data.message, 'success');
                } else {
                    $selectedRows.forEach($row => $row.css('opacity', '1'));
                    $('#agro-bulk-delete-btn').prop('disabled', false).text('Obriši odabrane (' + selectedCount + ')');
                    showToast(response.data.message || 'Greška pri brisanju operacija.', 'error');
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
