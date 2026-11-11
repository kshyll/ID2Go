


function selectStudent(ticket, name, studentId) {
    document.getElementById('rec-student-name').innerText = name;
    document.getElementById('rec-student-id').innerText = 'ID: ' + studentId;
    document.getElementById('rec-ticket-num').innerText = 'Ticket: ' + ticket;
}

function filterQueueTable() {
    const input = document.getElementById('queue-search');
    const filter = input.value.toUpperCase();
    const table = document.getElementById('table-live-queue');
    const tr = table.getElementsByTagName('tr');

    for (let i = 1; i < tr.length; i++) {
        let tdName = tr[i].getElementsByTagName('td')[1];
        let tdId = tr[i].getElementsByTagName('td')[0];
        if (tdName || tdId) {
            let txtValueName = tdName.textContent || tdName.innerText;
            let txtValueId = tdId.textContent || tdId.innerText;
            if (txtValueName.toUpperCase().indexOf(filter) > -1 || txtValueId.toUpperCase().indexOf(filter) > -1) {
                tr[i].style.display = "";
            } else {
                tr[i].style.display = "none";
            }
        }
    }
}

function saveStationSettings() {
    alert('Station availability configurations saved!');
}