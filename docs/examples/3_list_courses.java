import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONObject;

public class ListCoursesExample {
    public static void listCourses() throws IOException {
        URL url = new URL("http://localhost:3000/courses");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        
        connection.setRequestMethod("GET");
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setDoOutput(true);
        
        
        
        int code = connection.getResponseCode();
        System.out.println("Response Code: " + code);
    }
    
    public static void main(String[] args) throws IOException {
        listCourses();
    }
}