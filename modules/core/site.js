/* Ajax multiplexer */
Hm_Ajax = {
    request_count: 0,
    batch_callback: false,

    request: function(args, callback, extra, no_icon, batch_callback) {
        var ajax = new Hm_Ajax_Request();
        if (Hm_Ajax.request_count == 0) {
            if (!no_icon) {
                $('.loading_icon').fadeIn(300);
                $('body').addClass('wait');
            }
        }
        Hm_Ajax.request_count++;
        Hm_Ajax.batch_callback = batch_callback;
        return ajax.make_request(args, callback, extra);
    }
};

/* Ajax request wrapper */
Hm_Ajax_Request = function() { return { 

    callback: false,
    index: 0,
    start_time: 0,

    make_request: function(args, callback, extra) {
        this.callback = callback;
        if (extra) {
            for (name in extra) {
                args.push({'name': name, 'value': extra[name]});
            }
        }

        var dt = new Date();
        this.start_time = dt.getTime();
        $.ajax({
            type: "POST",
            url: '',
            data: args,
            context: this, 
            success: this.done,
            complete: this.always,
            error: this.fail
        });

        return false;
    },

    done: function(res) {
        if (typeof res == 'string' && (res == 'null' || res.indexOf('<') == 0 || res == '{}')) {
            this.fail(res);
            return;
        }
        else if (!res) {
            this.fail(res);
            return;
        }
        else {
            res = jQuery.parseJSON(res);
            if (res.date) {
                $('.date').html(res.date);
            }
            if (res.router_user_msgs && !jQuery.isEmptyObject(res.router_user_msgs)) {
                Hm_Notices.show(res.router_user_msgs);
            }
            if (this.callback) {
                this.callback(res);
            }
        }
    },

    fail: function(res) {
        Hm_Notices.show({0: 'An error occured communicating with the server'});
    },

    always: function(res) {
        var dt = new Date();
        var elapsed = dt.getTime() - this.start_time;
        var msg = 'AJAX request finished in ' + elapsed + ' millis';
        if (elapsed > 2000) {
            msg += '. Ouch!';
        }
        $('.elapsed').html(msg);
        Hm_Ajax.request_count--;
        if (Hm_Ajax.request_count == 0) {
            if (Hm_Ajax.batch_callback) {
                Hm_Ajax.batch_callback(res);
                Hm_Ajax.batch_callback = false;
            }
            $('.loading_icon').fadeOut(300);
            $('body').removeClass('wait');
        }
    }
}; };

/* user notification manager */
Hm_Notices = {

    hide_id: false,

    show: function(msgs) {
        var msg_list = $.map(msgs, function(v) {
            if (v.match(/^ERR/)) {
                return '<span class="err">'+v.substring(3)+'</span>';
            }
            return v;
        });
        $('.sys_messages').html(msg_list.join(', '));
        $('.sys_messages').slideDown(300);
    },

    hide: function(now) {
        if (Hm_Notices.hide_id) {
            clearTimeout(Hm_Notices.hide_id);
        }
        if (now) {
            $('.sys_messages').slideUp(300, function() {
                $('.sys_messages').html('');
                $('.sys_messages').show('');
            });
        }
        else {
            Hm_Notices.hide_id = setTimeout(function() {
                $('.sys_messages').slideUp(1000, function() {
                    $('.sys_messages').html('');
                    $('.sys_messages').show('');
                });
            }, 5000);
        }
    }
};

/* job scheduler */
Hm_Timer = {

    jobs: [],
    interval: 1000,

    add_job: function(job, interval, defer) {
        if (interval) {
            Hm_Timer.jobs.push([job, interval, interval]);
        }
        if (!defer) {
            try { job(); } catch(e) { console.log(e); }
        }
    },

    cancel: function(job) {
        for (index in Hm_Timer.jobs) {
            if (Hm_Timer.jobs[index][0] == job) {
                Hm_Timer.jobs.splice(index, 1);
                return true;
            }
        }
        return false;
    },

    fire: function() {
        var job;
        for (index in Hm_Timer.jobs) {
            job = Hm_Timer.jobs[index];
            job[2]--;
            if (job[2] == 0) {
                job[2] = job[1];
                Hm_Timer.jobs[index] = job;
                try { job[0](); } catch(e) { console.log(e); }
            }
        }
        setTimeout(Hm_Timer.fire, Hm_Timer.interval);
    }
};

/* message list */
var Hm_Message_List = {

    range_start: '',
    sources: [],
    sorts: {'source': 'asc', 'from': 'asc', 'subject': 'asc', 'msg_date': 'asc'},
    sort_type: 'numericasc',
    sort_fld: 'msg_date',

    update: function(ids, msgs, type) {
        if (msgs && !jQuery.isEmptyObject(msgs)) {
            $('.empty_list').remove();
        }
        var msg_ids = Hm_Message_List.add_rows(msgs);
        var count = Hm_Message_List.remove_rows(ids, msg_ids, type);
        return count;
    },

    remove_rows: function(ids, msg_ids, type) {
        var count = $('.message_table tbody tr').length;
        for (i=0;i<ids.length;i++) {
            $('.message_table tbody tr[class^='+type+'_'+ids[i]+'_]').filter(function() {
                var id = this.className;
                if (jQuery.inArray(id, msg_ids) == -1) {
                    count--;
                    $(this).remove();
                }
            });
        }
        return count;
    },

    sort_rows: function(sort_list, sort_type, dir) {
        switch(sort_type+dir) {
            case 'numericasc':
                sort_list.sort(function(a, b) { return Hm_Message_List.sort_numeric_asc(a, b); });
                break;
            case 'numericdesc':
                sort_list.sort(function(a, b) { return Hm_Message_List.sort_numeric_desc(a, b); });
                break;
            case 'alphadesc':
                sort_list.sort(function(a, b) { return Hm_Message_List.sort_alpha_desc(a, b); });
                break;
            case 'alphaasc':
                sort_list.sort(function(a, b) { return Hm_Message_List.sort_alpha_asc(a, b); });
            default:
                break;
        }
        Hm_Message_List.sort_type = sort_type;
        return sort_list;
    },

    sort_alpha_desc: function(a, b) {
        var res =  b[0][0].localeCompare(a[0][0]);
        if (res == 0) {
            return b[2] - a[2];
        }
        else {
            return res;
        }
    },

    sort_alpha_asc: function(a, b) {
        var res =  a[0][0].localeCompare(b[0][0]);
        if (res == 0) {
            return b[2] - a[2];
        }
        else {
            return res;
        }
    },

    sort_numeric_asc: function(a, b) {
        return a[0] - b[0];
    },

    sort_numeric_desc: function(a, b) {
        return b[0] - a[0];
    },

    sort_by_col: function(col_class) {
        var sort_val;
        var sort_type;
        var row_id;
        var sort_list = [];
        var new_list = [];
        var second_sort;
        var dir = Hm_Message_List.sorts[col_class];
        if (dir == 'asc') {
            Hm_Message_List.sorts[col_class] = 'desc';
        }
        else if (dir == 'desc') {
            Hm_Message_List.sorts[col_class] = 'asc';
        }

        if (col_class == 'msg_date') {
            sort_type = 'numeric';
        }
        else {
            sort_type = 'alpha';
        }
        $('.message_table tbody tr').each(function() {
            row_id = $(this).prop('class');
            if (col_class == 'msg_date') {
                sort_val = $('td.'+col_class+' input', $(this)).val();
                second_sort = sort_val;
            }
            else {
                sort_val = $('td.'+col_class, $(this)).text().toUpperCase();
                second_sort = $('td.msg_date input', $(this)).val();
            }
            sort_list.push([sort_val, row_id, second_sort]);
        });
        sort_list = Hm_Message_List.sort_rows(sort_list, sort_type, dir);
        for (i=0;i<sort_list.length;i++) {
            new_list.push($('.message_table tbody tr.'+sort_list[i][1]));
        }
        $('.message_table tbody').html(new_list);
    },

    add_rows: function(msgs) {
        var msg_ids = [];
        for (index in msgs) {
            row = msgs[index][0];
            id = msgs[index][1];
            if (!$('.'+clean_selector(id)).length) {
                Hm_Message_List.insert_into_message_list(row);
                $('.'+clean_selector(id)).show();
            }
            else {
                timestr = $('.msg_date', $(row)).html();
                subject = $('.subject', $(row)).html();
                timeint = $('.msg_timestamp', $(row)).val();
                $('.msg_date', $('.'+clean_selector(id))).html(timestr);
                $('.subject', $('.'+clean_selector(id))).html(subject);
                $('.msg_timestamp', $('.'+clean_selector(id))).val(timeint);
            }
            msg_ids.push(id);
        }
        return msg_ids;
    },
    insert_into_message_list: function(row) {
        var timestr = $('.msg_timestamp', $(row)).val();
        var element = false;
        $('.message_table tbody tr').each(function() {
            timestr2 = $('.msg_timestamp', $(this)).val();
            if ((timestr*1) >= (timestr2*1)) {
                element = $(this);
                return false;
            }
        });
        if (element) {
            $(row).insertBefore(element);
        }
        else {
            $('.message_table tbody').append(row);
        }
    },

    reset_checkboxes: function() {
        $(':checkbox').each(function () { this.checked = false; });
        Hm_Message_List.toggle_msg_controls();
        $(':checkbox').click(function(e) {
            Hm_Message_List.toggle_msg_controls();
            Hm_Message_List.check_select_range(e);
        });
        Hm_Message_List.enable_sort();
    },

    select_range: function(start, end) {
        var found = false;
        var other = false;
        $('.message_table tbody tr').each(function() {
            if (found) {
                $(':checkbox', $(this)).prop('checked', true);
                if ($(this).prop('class') == other) {
                    return false;
                }
            }
            if ($(this).prop('class') == start) {
                found = true;
                other = end;
            }
            if ($(this).prop('class') == end) {
                found = true;
                other = start;
            }
        });
        
    },

    check_select_range: function(event_object) {
        var start;
        var end;
        if (event_object && event_object.shiftKey) {
            if (event_object.target.checked) {
                if (Hm_Message_List.range_start != '') {
                    start = Hm_Message_List.range_start;
                    end = event_object.target.value;
                    Hm_Message_List.select_range(start, end);
                    Hm_Message_List.range_start = '';
                }
                else {
                   Hm_Message_List.range_start = event_object.target.value; 
                }
            }
        }

    },

    remove_from_cache: function(cached_list_name, row_class) {
        var count = 0;
        var cache_data = get_from_local_storage(cached_list_name);
        if (cache_data) {
            var adjusted_data = $('<div></div>').append(cache_data).find('tr').remove('.'+clean_selector(row_class)).end().html();
            save_to_local_storage(cached_list_name, adjusted_data);
            count = $(adjusted_data).length;
        }
        return count;
    },

    toggle_msg_controls: function() {
        if ($('input:checked').length > 0) {
            $('.msg_controls a').filter(function(index) { return this.className != 'toggle_link'; }).removeClass('disabled_link');
        }
        else {
            $('.msg_controls a').filter(function(index) { return this.className != 'toggle_link'; }).addClass('disabled_link');
        }
    },

    update_after_action: function(action_type, selected) {
        var remove = false;
        var row = false;
        var class_name = false;
        var count = $(".message_list tbody tr").length;
        if (action_type == 'read' && hm_list_path == 'unread') {
            remove = true;
        }
        else if (action_type == 'delete') {
            remove = true;
        }
        if (remove) {
            for (index in selected) {
                class_name = selected[index];
                count--;
                $('.'+clean_selector(class_name)).fadeOut(200, function() { $(this).remove(); });
            }
        }
        for (index in selected) {
            class_name = selected[index];
            Hm_Message_List.remove_from_cache('formatted_unread_data', class_name);
        }
        Hm_Message_List.reset_checkboxes();
    },

    enable_sort: function() {
        $('.message_table th').click(function() {
            var sort_type = $(this).prop('class');
            Hm_Message_List.sort_by_col(sort_type, 'asc');
        });
    },

    load_sources: function() {
        for (index in Hm_Message_List.sources) {
            source = Hm_Message_List.sources[index];
            source.callback(source.id);
        }
        return false;
    },

    setup_combined_view: function(cache_name) {
        var data = get_from_local_storage(cache_name);
        if (data && data.length) {
            $('.message_table tbody').html(data);
        }
        Hm_Timer.add_job(Hm_Message_List.load_sources, 60);
    },

    update_count: function(type) {
        if (type == 'unread') {
            var count = $('.message_table tbody tr').length;
            $('.unread_count').text(count);
            document.title = 'HM3 '+count+' Unread';
        }
        else if (type == 'flagged') {
            var count = $('.message_table tbody tr').length;
            $('.flagged_count').text(count);
            document.title = 'HM3 '+count+' Flagged';
        }
        else if (type == 'combined_inbox') {
            var count = $('.message_table tbody tr').length;
            $('.combined_inbox_count').text(count);
            document.title = 'HM3 '+count+' in Everything';
        }
        else if (type == 'feeds') {
            var count = $('.unseen', $('.message_table tbody')).length;
            $('.unread_feed_count').text(count);
            document.title = 'HM3 '+count+' New in Feeds';
        }
        save_folder_list();
    }
};

var save_folder_list = function() {
    save_to_local_storage('formatted_folder_list', $('.folder_list').html());
};

var message_action = function(action_type) {
    var msg_list = $('.message_list');
    var selected = [];
    $('input[type=checkbox]:checked', msg_list).each(function() {
        selected.push($(this).val());
    });
    if (selected.length > 0) {
        Hm_Ajax.request(
            [{'name': 'hm_ajax_hook', 'value': 'ajax_message_action'},
            {'name': 'action_type', 'value': action_type},
            {'name': 'message_ids', 'value': selected}],
            false,
            [],
            false,
            reload_after_message_action
        );
        Hm_Message_List.update_after_action(action_type, selected);
    }
    return false;
};

var reload_after_message_action = function() {
    Hm_Message_List.load_sources();
};

var confirm_logout = function() {
    $('.confirm_logout').fadeIn(200);
    return false;
};

var parse_folder_path = function(path, path_type) {
    var type = false;
    var server_id = false;
    var uid = false;
    var folder = '';

    if (path_type == 'imap') {
        parts = path.split('_', 4);
        if (parts.length == 2) {
            type = parts[0];
            server_id = parts[1];
        }
        else if (parts.length == 3) {
            type = parts[0];
            server_id = parts[1];
            folder = parts[2];
        }
        else if (parts.length == 4) {
            type = parts[0];
            server_id = parts[1];
            uid = parts[2];
            folder = parts[3];
        }
        if (type && server_id) {
            return {'type': type, 'server_id' : server_id, 'folder' : folder, 'uid': uid}
        }
    }
    else if (path_type == 'pop3' || path_type == 'feeds') {
        parts = path.split('_', 3);
        if (parts.length > 1) {
            type = parts[0];
            server_id = parts[1];
        }
        if (parts.length == 3) {
            uid = parts[2];
        }
        if (type && server_id) {
            return {'type': type, 'server_id' : server_id, 'uid': uid}
        }
    }
    return false;
};

var prev_next_links = function(cache, class_name) {
    var href;
    var plink = false;
    var nlink = false;
    var list = get_from_local_storage(cache);
    var current = $('<div></div>').append(list).find('.'+clean_selector(class_name));
    var prev = current.prev();
    var next = current.next();
    var header_links = $('.header_links');
    if (header_links.length) {
        target = header_links.parent();
    }
    else {
        target = $('.msg_headers tr').last();
    }
    if (prev.length) {
        href = prev.find('.subject').find('a').prop('href');
        plink = '<a class="plink" href="'+href+'">'+prev.find('.subject').text()+'</a>';
        $('<tr class="prev"><th colspan="2"><img class="prevnext" src="images/open_iconic/arrow-circle-top-2x.png" width="16" height="16" /> '+plink+'</th></tr>').insertBefore(target);
    }
    if (next.length) {
        href = next.find('.subject').find('a').prop('href');
        nlink = '<a class="nlink" href="'+href+'">'+next.find('.subject').text()+'</a>';
        $('<tr class="next"><th colspan="2"><img class="prevnext" src="images/open_iconic/arrow-circle-bottom-2x.png" width="16" height="16" /> '+nlink+'</th></tr>').insertBefore(target);
    }
};
var open_folder_list = function() {
    $('.folder_list').toggle(200);
    toggle_section('.main');
    $('.folder_toggle').toggle(100);
    save_to_local_storage('hide_folder_list', '');
    return false;
};

var hide_folder_list = function() {
    $('.folder_toggle').toggle(100);
    save_to_local_storage('formatted_folder_list', $('.folder_list').html());
    save_to_local_storage('hide_folder_list', '1');
};

var toggle_section = function(class_name) {
    if ($(class_name).length) {
        $(class_name).toggle(200, function() {
            if ($('.main').css('display') == 'none' && $('.settings').css('display') == 'none' && $('.imap_folders').css('display') == 'none' && $('.pop3_folders').css('display') == 'none' && $('.feeds_folders').css('display') == 'none') {
                $('.folder_list').toggle(200, function() {
                    hide_folder_list();
                });
            }
            else {
                save_to_local_storage('formatted_folder_list', $('.folder_list').html());
            }
        });
    }
    return false;
};

var get_from_local_storage = function(key) {
    return sessionStorage.getItem(key);
};

var reload_folders = function() {
    if (document.cookie.indexOf('hm_reload_folders=1') > -1) {
        update_folder_list();
        sessionStorage.clear();
        document.cookie = 'hm_reload_folders=; expires=' + new Date(0).toUTCString();
    }
};

var save_to_local_storage = function(key, val) {
    if (typeof(Storage) !== "undefined") {
        sessionStorage.setItem(key, val);
    }
    return false;
};

var update_folder_list_display = function(res) {
    $('.folder_list').html(res.formatted_folder_list);
    save_to_local_storage('formatted_folder_list', res.formatted_folder_list);
    hl_selected_menu();
};

var update_folder_list = function() {
    Hm_Ajax.request(
        [{'name': 'hm_ajax_hook', 'value': 'ajax_hm_folders'}],
        update_folder_list_display,
        [],
        false
    );
    return false;
};

var clean_selector = function(str) {
    return str.replace(/(:|\.|\[|\]|\/)/g, "\\$1");
};

var hl_selected_menu = function() {
    $('.folder_list').find('*').removeClass('selected_menu');
    if (hm_page_name == 'message_list') {
        $('a:eq(0)', $('.'+clean_selector(hm_list_path))).addClass('selected_menu');
        $('a:eq(1)', $('.'+clean_selector(hm_list_path))).addClass('selected_menu');
        $('.menu_'+clean_selector(hm_list_path)).addClass('selected_menu');
    }
    else if (hm_list_parent) {
        $('a:eq(0)', $('.'+clean_selector(hm_list_parent))).addClass('selected_menu');
        $('a:eq(1)', $('.'+clean_selector(hm_list_parent))).addClass('selected_menu');
        $('.menu_'+clean_selector(hm_list_parent)).addClass('selected_menu');
    }
    else {
        $('.menu_'+hm_page_name).addClass('selected_menu');
    }
};

var set_combined_inbox_state = function() {
    var data = $('.message_table tbody');
    data.find('*[style]').attr('style', '');
    save_to_local_storage('formatted_combined_inbox', data.html());
    Hm_Message_List.update_count('combined_inbox');
    var empty = check_empty_list();
    if (!empty) {
        $(':checkbox').click(function(e) {
            Hm_Message_List.toggle_msg_controls();
            Hm_Message_List.check_select_range(e);
        });
    }
};

var check_empty_list = function() {
    var count = $('.message_table tbody tr').length;
    console.log(count);
    if (!count) {
        if (!$('.empty_list').length) {
            $('.message_list').append('<div class="empty_list">So Alone!</div>');
        }
    }
    return count == 0;
};

var folder_list = get_from_local_storage('formatted_folder_list');

var update_unread_count = function() {
};

$(function() {
    if (folder_list) {
        $('.folder_list').html(folder_list);
        if (get_from_local_storage('hide_folder_list') == '1') {
            $('.folder_list').hide();
            $('.folder_toggle').show();
        }
        hl_selected_menu();
    }
    else {
        update_folder_list();
    }
    if (hm_page_name == 'message_list') {
        if (hm_list_path == 'feeds') {
            Hm_Message_List.setup_combined_view('formatted_feed_data');
        }
        if (hm_list_path == 'combined_inbox') {
            Hm_Message_List.setup_combined_view('formatted_combined_inbox');
        }
        else if (hm_list_path == 'unread') {
            Hm_Message_List.setup_combined_view('formatted_unread_data');
        }
        else if (hm_list_path == 'flagged') {
            Hm_Message_List.setup_combined_view('formatted_flagged_data');
        }
    }
    else if (hm_page_name == 'settings' || hm_page_name == 'servers') {
        reload_folders();
    }
    $('body').fadeIn(300);
    Hm_Timer.fire();
    if ($('.sys_messages').text().length) {
        $('.sys_messages').fadeIn();
    }
});
