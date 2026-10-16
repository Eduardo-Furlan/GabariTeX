pub const MARK_PX: f64 = 10.0;
pub const MARK_GAP_PX: f64 = 6.0;
pub const LABEL_PX: f64 = 48.0;
pub const BUBBLE_PX: f64 = 24.0;
pub const OPTIONS_PX: f64 = 176.0;
pub const OPTIONS_COUNT: usize = 5;
pub const MAX_QUESTIONS: usize = 40;
pub const SINGLE_COLUMN_MAX: usize = 12;

pub const OPTION_OFFSETS_PX: [f64; 5] = [76.6, 111.8, 147.0, 182.2, 217.4];

pub fn get_column_layout(total: usize) -> (usize, usize) {
    let columns = if total <= SINGLE_COLUMN_MAX { 1 } else { 2 };
    let per_column = if columns == 1 {
        total
    } else {
        (total + 1) / 2
    };
    (columns, per_column)
}

